const core = require('@actions/core');
const github = require('@actions/github');
const { google } = require('googleapis');
const moment = require('moment-timezone');

// Bikeshedding topics that might need discussion
const bikeshedTopics = [
  { topic: 'naming conventions', meetingLength: 180, urgency: 'critical' },
  { topic: 'whitespace philosophy', meetingLength: 120, urgency: 'urgent' },
  { topic: 'variable name choice', meetingLength: 240, urgency: 'important' },
  { topic: 'code formatting strategy', meetingLength: 90, urgency: 'essential' },
  { topic: 'indentation patterns', meetingLength: 180, urgency: 'high-priority' },
  { topic: 'comment formatting standards', meetingLength: 150, urgency: 'immediate' },
  { topic: 'architectural design patterns', meetingLength: 300, urgency: 'strategic' },
  { topic: 'code structure and organization', meetingLength: 240, urgency: 'foundational' },
  { topic: 'syntax style consistency', meetingLength: 180, urgency: 'critical' },
  { topic: 'function design principles', meetingLength: 210, urgency: 'architectural' }
];

// Meeting title templates
const meetingTitles = [
  'Quick sync about line {LINE_NUMBER}',
  'Discussion: Your approach to {TOPIC}',
  'Alignment session: Code review for {FILE}',
  'Deep dive: The {FILE} implementation',
  'Review session: {FILE} best practices',
  'Workshop: Exploring alternatives for {CODE_SNIPPET}',
  '1:1 Code review discussion',
  'Collaborative review session',
  'Code quality discussion',
  'Technical alignment: {TOPIC}'
];

class BikeshedBot {
  constructor() {
    this.octokit = github.getOctokit(core.getInput('github-token', { required: true }));
    this.context = github.context;
    this.calendarEnabled = core.getInput('enable-calendar') === 'true';
    this.maxMeetingsPerPR = parseInt(core.getInput('max-meetings-per-pr') || '3');
    this.commentStyle = core.getInput('comment-style') || 'constructive';
  }

  async run() {
    try {
      if (this.context.eventName !== 'pull_request') {
        core.info('This action only runs on pull request events');
        return;
      }

      const concerns = await this.analyzePR();
      await this.postComments(concerns);
      
      core.setOutput('concerns-found', concerns.length);
      core.setOutput('meetings-scheduled', Math.min(concerns.length, this.maxMeetingsPerPR));
    } catch (error) {
      core.setFailed(`Action failed: ${error.message}`);
    }
  }

  async analyzePR() {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      ...this.context.repo,
      pull_number: this.context.payload.pull_request.number,
    });

    const concerns = [];
    const minConcerns = parseInt(core.getInput('min-concerns') || '1');
    
    for (const file of files) {
      const lines = file.patch?.split('\n') || [];
      const addedLines = lines.filter(line => line.startsWith('+'));
      
      // Analyze file for potential discussion points
      if (file.filename.includes('.') && Math.random() < 0.7) {
        concerns.push({
          file: file.filename,
          line: Math.floor(Math.random() * 50) + 1,
          topic: bikeshedTopics[Math.floor(Math.random() * bikeshedTopics.length)],
          severity: this.calculateSeverity(),
          codeSnippet: addedLines[0]?.substring(1) || 'the implementation'
        });
      }

      // Additional concerns for specific patterns
      if (file.filename.includes('test') && Math.random() < 0.5) {
        concerns.push({
          file: file.filename,
          topic: { topic: 'test coverage approach', meetingLength: 240, urgency: 'quality-focused' },
          severity: 'DISCUSSION_NEEDED'
        });
      }

      if (addedLines.some(line => line.includes('TODO')) && Math.random() < 0.8) {
        concerns.push({
          file: file.filename,
          topic: { topic: 'TODO items and technical debt', meetingLength: 180, urgency: 'planning-required' },
          severity: 'FOLLOW_UP_NEEDED'
        });
      }
    }

    // Ensure minimum number of concerns
    while (concerns.length < minConcerns) {
      concerns.push({
        file: 'overall approach',
        topic: bikeshedTopics[Math.floor(Math.random() * bikeshedTopics.length)],
        severity: 'WORTH_DISCUSSING'
      });
    }

    return concerns.slice(0, this.maxMeetingsPerPR);
  }

  calculateSeverity() {
    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'DISCUSSION_NEEDED', 'WORTH_NOTING'];
    return severities[Math.floor(Math.random() * severities.length)];
  }

  async postComments(concerns) {
    // Post overview comment
    const overviewComment = this.generateOverviewComment(concerns);
    
    await this.octokit.rest.issues.createComment({
      ...this.context.repo,
      issue_number: this.context.payload.pull_request.number,
      body: overviewComment
    });

    // Post individual comments and schedule meetings
    for (const concern of concerns) {
      const comment = await this.generateComment(concern);
      
      await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request.number,
        body: comment
      });

      // Add labels if configured
      if (core.getInput('add-labels') === 'true') {
        await this.addLabels(concern);
      }
    }
  }

  generateOverviewComment(concerns) {
    const botName = core.getInput('bot-name') || 'Bikeshed Bot';
    const emoji = core.getInput('use-emojis') === 'true' ? '🤖 ' : '';
    
    return `## ${emoji}${botName} Review\n\n` +
      `I've completed my review of this PR and identified **${concerns.length} area${concerns.length === 1 ? '' : 's'}** for discussion:\n\n` +
      concerns.map((c, i) => 
        `${i + 1}. **${c.topic.topic}** in \`${c.file}\` (${c.topic.urgency})`
      ).join('\n') +
      (this.calendarEnabled ? 
        '\n\n📅 Meeting invitations will be sent for detailed discussions.' : 
        '\n\n💬 Let\'s discuss these points in the PR comments.') +
      '\n\n*This automated review helps ensure code quality through collaborative discussion.*';
  }

  async generateComment(concern) {
    const templates = this.getCommentTemplates();
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    let comment = template
      .replace('{FILE}', concern.file)
      .replace('{TOPIC}', concern.topic.topic)
      .replace('{CODE_SNIPPET}', concern.codeSnippet || 'this implementation')
      .replace('{URGENCY}', concern.topic.urgency)
      .replace('{LINE_NUMBER}', concern.line || '1');

    if (this.calendarEnabled && concern.meeting) {
      comment += '\n\n📅 **Meeting Details:**\n' +
        `- Time: ${concern.meeting.time}\n` +
        `- Duration: ${concern.meeting.duration} minutes\n` +
        `- Topic: ${concern.topic.topic}`;
    }

    return comment;
  }

  getCommentTemplates() {
    if (this.commentStyle === 'friendly') {
      return [
        'Hey! I noticed an interesting pattern in {FILE}. Would love to discuss {TOPIC} when you have a chance! 😊',
        'Great work on {FILE}! I have some thoughts about {TOPIC} that might be worth exploring together.',
        'Thanks for this PR! Quick question about {CODE_SNIPPET} - could we chat about the approach?',
      ];
    } else if (this.commentStyle === 'formal') {
      return [
        'Regarding {FILE}: The implementation of {TOPIC} warrants further discussion.',
        'Technical review note: {CODE_SNIPPET} in {FILE} presents an opportunity for architectural alignment.',
        'Code review finding: {TOPIC} implementation requires stakeholder input.',
      ];
    } else {
      return [
        'I noticed {FILE} implements {TOPIC}. Let\'s discuss potential optimizations.',
        'The approach in {FILE} raises some questions about {TOPIC}. Could we explore alternatives?',
        'Regarding {CODE_SNIPPET}: This implementation would benefit from a brief discussion about {TOPIC}.',
        'I see you\'ve implemented {TOPIC} in {FILE}. Let\'s align on best practices.',
        'This is an interesting approach to {TOPIC}. A quick sync would help ensure we\'re aligned.',
      ];
    }
  }

  async addLabels(concern) {
    try {
      const labels = [
        'needs-discussion',
        `priority-${concern.severity.toLowerCase()}`,
        'bikeshed-review'
      ];

      await this.octokit.rest.issues.addLabels({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request.number,
        labels: labels.filter(l => l)
      });
    } catch (error) {
      core.warning(`Could not add labels: ${error.message}`);
    }
  }

  async scheduleMeeting(concern) {
    if (!this.calendarEnabled) return null;

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(core.getInput('google-calendar-credentials')),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      const calendar = google.calendar({ version: 'v3', auth });
      const calendarId = core.getInput('google-calendar-id');

      const now = moment().tz(core.getInput('timezone') || 'America/New_York');
      const meetingStart = this.findNextAvailableSlot(now);
      const meetingEnd = meetingStart.clone().add(concern.topic.meetingLength, 'minutes');

      const titleTemplate = meetingTitles[Math.floor(Math.random() * meetingTitles.length)];
      const title = titleTemplate
        .replace('{LINE_NUMBER}', concern.line || '1')
        .replace('{TOPIC}', concern.topic.topic)
        .replace('{FILE}', concern.file)
        .replace('{CODE_SNIPPET}', 'the code');

      const event = {
        summary: `[Code Review] ${title}`,
        description: this.generateMeetingDescription(concern),
        start: {
          dateTime: meetingStart.format(),
          timeZone: meetingStart.tz(),
        },
        end: {
          dateTime: meetingEnd.format(),
          timeZone: meetingEnd.tz(),
        },
        attendees: this.getMeetingAttendees(),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        sendUpdates: 'all',
      });

      return {
        link: response.data.htmlLink,
        time: meetingStart.format('MMMM Do YYYY, h:mm a'),
        duration: concern.topic.meetingLength
      };
    } catch (error) {
      core.warning(`Calendar scheduling failed: ${error.message}`);
      return null;
    }
  }

  findNextAvailableSlot(now) {
    const preferredHours = core.getInput('preferred-meeting-hours')?.split(',').map(h => parseInt(h)) || [10, 14, 15];
    let meetingStart = now.clone().add(1, 'day');
    
    // Skip weekends
    if (meetingStart.day() === 0) meetingStart.add(1, 'day');
    if (meetingStart.day() === 6) meetingStart.add(2, 'days');
    
    // Set to preferred hour
    const hour = preferredHours[Math.floor(Math.random() * preferredHours.length)];
    meetingStart.hour(hour).minute(0).second(0);
    
    return meetingStart;
  }

  generateMeetingDescription(concern) {
    return `This meeting is to discuss ${concern.topic.topic} in the recent pull request.\n\n` +
           `File: ${concern.file}\n` +
           `Priority: ${concern.topic.urgency}\n\n` +
           'Topics to cover:\n' +
           '- Current implementation approach\n' +
           '- Best practices and alternatives\n' +
           '- Action items and next steps\n\n' +
           'This is an automated meeting request from the Bikeshed Bot code review system.';
  }

  getMeetingAttendees() {
    const attendees = [];
    const prAuthorEmail = core.getInput('pr-author-email');
    const reviewerEmails = core.getInput('reviewer-emails');
    
    if (prAuthorEmail) {
      attendees.push({ email: prAuthorEmail });
    }
    
    if (reviewerEmails) {
      reviewerEmails.split(',').forEach(email => {
        attendees.push({ email: email.trim() });
      });
    }
    
    return attendees;
  }
}

// Run the action
if (require.main === module) {
  const bot = new BikeshedBot();
  bot.run();
}

module.exports = BikeshedBot;