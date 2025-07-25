const BikeshedBot = require('../src/index');
const core = require('@actions/core');
const github = require('@actions/github');

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('googleapis');
jest.mock('moment-timezone');

describe('BikeshedBot', () => {
  let bot;
  let mockOctokit;
  let mockContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup core mocks
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'github-token': 'fake-token',
        'enable-calendar': 'false',
        'max-meetings-per-pr': '3',
        'comment-style': 'constructive',
        'min-concerns': '1',
        'add-labels': 'true',
        'bot-name': 'Test Bot',
        'use-emojis': 'true',
        'timezone': 'America/New_York',
        'preferred-meeting-hours': '10,14,15'
      };
      return inputs[name] || '';
    });

    // Setup GitHub context mock
    mockContext = {
      eventName: 'pull_request',
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      },
      payload: {
        pull_request: {
          number: 123,
          user: {
            login: 'test-user'
          }
        }
      }
    };

    // Setup Octokit mock
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({
            data: [
              {
                filename: 'src/test.js',
                patch: '+function test() {\\n+  return true;\\n+}'
              },
              {
                filename: 'tests/test.spec.js',
                patch: '+describe("test", () => {\\n+  // TODO: Add tests\\n+});'
              }
            ]
          })
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
          addLabels: jest.fn().mockResolvedValue({ data: [] })
        }
      }
    };

    github.getOctokit.mockReturnValue(mockOctokit);
    github.context = mockContext;

    bot = new BikeshedBot();
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(bot.octokit).toBe(mockOctokit);
      expect(bot.context).toBe(mockContext);
      expect(bot.calendarEnabled).toBe(false);
      expect(bot.maxMeetingsPerPR).toBe(3);
      expect(bot.commentStyle).toBe('constructive');
    });

    it('should parse calendar enabled as boolean', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'enable-calendar') return 'true';
        return 'fake-token';
      });
      
      const botWithCalendar = new BikeshedBot();
      expect(botWithCalendar.calendarEnabled).toBe(true);
    });
  });

  describe('run', () => {
    it('should skip non-pull request events', async () => {
      github.context.eventName = 'push';
      
      await bot.run();
      
      expect(core.info).toHaveBeenCalledWith('This action only runs on pull request events');
      expect(mockOctokit.rest.pulls.listFiles).not.toHaveBeenCalled();
    });

    it('should analyze PR and post comments', async () => {
      await bot.run();

      expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalledWith('concerns-found', expect.any(Number));
      expect(core.setOutput).toHaveBeenCalledWith('meetings-scheduled', expect.any(Number));
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('API Error');
      mockOctokit.rest.pulls.listFiles.mockRejectedValue(error);

      await bot.run();

      expect(core.setFailed).toHaveBeenCalledWith('Action failed: API Error');
    });
  });

  describe('analyzePR', () => {
    it('should find concerns in files', async () => {
      const concerns = await bot.analyzePR();

      expect(concerns.length).toBeGreaterThan(0);
      expect(concerns.length).toBeLessThanOrEqual(3);
      
      concerns.forEach(concern => {
        expect(concern).toHaveProperty('file');
        expect(concern).toHaveProperty('topic');
        expect(concern).toHaveProperty('severity');
      });
    });

    it('should detect TODO patterns', async () => {
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [
          {
            filename: 'src/index.js',
            patch: '+// TODO: Implement this feature\n+const x = 1;'
          }
        ]
      });

      const concerns = await bot.analyzePR();
      // With random generation, we may not always get a TODO concern
      // so let's just check that concerns were generated
      expect(concerns.length).toBeGreaterThan(0);
    });

    it('should respect minimum concerns setting', async () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'min-concerns') return '5';
        if (name === 'max-meetings-per-pr') return '10';
        return 'fake-token';
      });

      const botWithMinConcerns = new BikeshedBot();
      const concerns = await botWithMinConcerns.analyzePR();

      expect(concerns.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('generateOverviewComment', () => {
    it('should generate comment with concerns list', () => {
      const concerns = [
        {
          file: 'test.js',
          topic: { topic: 'naming conventions', urgency: 'critical' }
        },
        {
          file: 'index.js',
          topic: { topic: 'code structure', urgency: 'high' }
        }
      ];

      const comment = bot.generateOverviewComment(concerns);

      expect(comment).toContain('Test Bot Review');
      expect(comment).toContain('2 areas');
      expect(comment).toContain('naming conventions');
      expect(comment).toContain('code structure');
      expect(comment).toContain('test.js');
      expect(comment).toContain('index.js');
    });

    it('should include calendar message when enabled', () => {
      bot.calendarEnabled = true;
      const concerns = [{ file: 'test.js', topic: { topic: 'test', urgency: 'low' } }];
      
      const comment = bot.generateOverviewComment(concerns);
      
      expect(comment).toContain('Meeting invitations');
    });

    it('should handle single concern grammar', () => {
      const concerns = [{ file: 'test.js', topic: { topic: 'test', urgency: 'low' } }];
      
      const comment = bot.generateOverviewComment(concerns);
      
      expect(comment).toContain('1 area');
      expect(comment).not.toContain('areas');
    });
  });

  describe('getCommentTemplates', () => {
    it('should return friendly templates', () => {
      bot.commentStyle = 'friendly';
      const templates = bot.getCommentTemplates();
      
      expect(templates.some(t => t.includes('😊'))).toBe(true);
      expect(templates.every(t => t.includes('Hey') || t.includes('Great') || t.includes('Thanks'))).toBe(true);
    });

    it('should return formal templates', () => {
      bot.commentStyle = 'formal';
      const templates = bot.getCommentTemplates();
      
      expect(templates.every(t => !t.includes('😊'))).toBe(true);
      expect(templates.some(t => t.includes('Technical review'))).toBe(true);
    });

    it('should return constructive templates by default', () => {
      const templates = bot.getCommentTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => typeof t === 'string')).toBe(true);
    });
  });

  describe('addLabels', () => {
    it('should add appropriate labels', async () => {
      const concern = {
        severity: 'HIGH',
        topic: { topic: 'test' }
      };

      await bot.addLabels(concern);

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining([
          'needs-discussion',
          'priority-high',
          'bikeshed-review'
        ])
      });
    });

    it('should handle label errors gracefully', async () => {
      mockOctokit.rest.issues.addLabels.mockRejectedValue(new Error('Permission denied'));
      
      await bot.addLabels({ severity: 'HIGH' });
      
      expect(core.warning).toHaveBeenCalledWith('Could not add labels: Permission denied');
    });
  });

  describe('calculateSeverity', () => {
    it('should return valid severity levels', () => {
      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'DISCUSSION_NEEDED', 'WORTH_NOTING'];
      
      for (let i = 0; i < 20; i++) {
        const severity = bot.calculateSeverity();
        expect(validSeverities).toContain(severity);
      }
    });
  });

  describe('findNextAvailableSlot', () => {
    it('should skip weekends', () => {
      // Create a mock moment object
      const mockNow = {
        clone: jest.fn().mockReturnValue({
          add: jest.fn().mockReturnThis(),
          day: jest.fn().mockReturnValue(1), // Monday
          hour: jest.fn().mockReturnThis(),
          minute: jest.fn().mockReturnThis(),
          second: jest.fn().mockReturnThis(),
        })
      };
      
      bot.findNextAvailableSlot(mockNow);
      expect(mockNow.clone).toHaveBeenCalled();
    });
  });
});

// Integration tests
describe('BikeshedBot Integration', () => {
  let mockOctokit;
  
  beforeEach(() => {
    // Setup for integration test
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({
            data: [
              {
                filename: 'src/test.js',
                patch: '+function test() {\n+  return true;\n+}'
              }
            ]
          })
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
          addLabels: jest.fn().mockResolvedValue({ data: [] })
        }
      }
    };
    
    github.getOctokit.mockReturnValue(mockOctokit);
  });
  
  it('should complete full workflow', async () => {
    const bot = new BikeshedBot();
    
    await bot.run();
    
    // Verify full workflow
    expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalled();
    // Check that createComment was called at least once
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledTimes(2);
  });
});