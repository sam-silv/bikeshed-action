# Bikeshed Bot Action

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/sam-silv/bikeshed-action/actions/workflows/test.yml/badge.svg)](https://github.com/sam-silv/bikeshed-action/actions/workflows/test.yml)

A GitHub Action that automatically reviews pull requests and creates constructive comments to encourage code quality discussions. Optionally integrates with Google Calendar to schedule meetings for more complex discussions.

## Features

- 🔍 **Automated Code Review**: Analyzes pull requests and identifies areas for discussion
- 💬 **Constructive Comments**: Posts helpful, customizable comments on PRs
- 📅 **Optional Calendar Integration**: Schedule meetings for detailed discussions
- 🏷️ **Automatic Labeling**: Adds relevant labels to PRs based on findings
- ⚙️ **Highly Configurable**: Customize comment style, meeting preferences, and more
- 🧪 **Well Tested**: Comprehensive unit test coverage

## Quick Start

Add this to your workflow file (`.github/workflows/bikeshed.yml`):

```yaml
name: Bikeshed Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      issues: write
    
    steps:
      - name: Bikeshed Review
        uses: sam-silv/bikeshed-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          comment-style: 'constructive'
          max-meetings-per-pr: 3
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `enable-calendar` | Enable Google Calendar integration | No | `false` |
| `google-calendar-credentials` | Google Calendar API credentials (JSON) | No | - |
| `google-calendar-id` | Google Calendar ID for meetings | No | - |
| `max-meetings-per-pr` | Maximum meetings to schedule per PR | No | `3` |
| `min-concerns` | Minimum concerns to find in a PR | No | `1` |
| `comment-style` | Comment style: friendly, formal, or constructive | No | `constructive` |
| `add-labels` | Whether to add labels to PRs | No | `true` |
| `bot-name` | Name of the bot in comments | No | `Bikeshed Bot` |
| `use-emojis` | Use emojis in comments | No | `true` |
| `timezone` | Timezone for scheduling meetings | No | `America/New_York` |
| `preferred-meeting-hours` | Preferred meeting hours (24h format) | No | `10,14,15` |
| `pr-author-email` | PR author's email for meeting invites | No | - |
| `reviewer-emails` | Reviewer emails (comma-separated) | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `concerns-found` | Number of concerns identified in the PR |
| `meetings-scheduled` | Number of meetings scheduled (if calendar enabled) |

## Examples

### Basic Usage

```yaml
- name: Bikeshed Review
  uses: sam-silv/bikeshed-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Calendar Integration

```yaml
- name: Bikeshed Review with Meetings
  uses: sam-silv/bikeshed-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    enable-calendar: true
    google-calendar-credentials: ${{ secrets.GOOGLE_CALENDAR_CREDS }}
    google-calendar-id: ${{ secrets.GOOGLE_CALENDAR_ID }}
    pr-author-email: ${{ github.event.pull_request.user.email }}
```

### Friendly Style Comments

```yaml
- name: Friendly Bikeshed Review
  uses: sam-silv/bikeshed-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    comment-style: friendly
    use-emojis: true
    bot-name: 'Code Buddy'
```

### Formal Corporate Style

```yaml
- name: Formal Code Review
  uses: sam-silv/bikeshed-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    comment-style: formal
    use-emojis: false
    add-labels: true
    min-concerns: 2
```

## Setting Up Google Calendar Integration

1. Create a Google Cloud Project and enable the Calendar API
2. Create a service account and download the credentials JSON
3. Share your calendar with the service account email
4. Add the credentials as a GitHub secret:

```bash
# Encode your credentials file
base64 -i credentials.json | pbcopy  # macOS
# or
base64 credentials.json | xclip -selection clipboard  # Linux
```

5. Add to your workflow:

```yaml
google-calendar-credentials: ${{ secrets.GOOGLE_CALENDAR_CREDS }}
google-calendar-id: 'your-calendar-id@group.calendar.google.com'
```

## Comment Styles

### Constructive (Default)
Professional and balanced comments focused on improvement:
- "I noticed {FILE} implements {TOPIC}. Let's discuss potential optimizations."
- "The approach in {FILE} raises some questions about {TOPIC}. Could we explore alternatives?"

### Friendly
Warm and encouraging comments with emojis:
- "Hey! I noticed an interesting pattern in {FILE}. Would love to discuss {TOPIC} when you have a chance! 😊"
- "Great work on {FILE}! I have some thoughts about {TOPIC} that might be worth exploring together."

### Formal
Corporate-style professional comments:
- "Regarding {FILE}: The implementation of {TOPIC} warrants further discussion."
- "Technical review note: {CODE_SNIPPET} in {FILE} presents an opportunity for architectural alignment."

## Topics Analyzed

The bot looks for various code patterns and topics:
- Naming conventions
- Code structure and organization
- Test coverage approaches
- TODO items and technical debt
- Architectural patterns
- Code formatting and style
- Function design principles

## Labels Added

When `add-labels` is enabled, the bot adds:
- `needs-discussion` - For all PRs with findings
- `priority-{level}` - Based on concern severity
- `bikeshed-review` - To identify bot-reviewed PRs

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/sam-silv/bikeshed-action
cd bikeshed-action

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

### Testing

The action includes comprehensive unit tests. Run them with:

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the eternal quest for perfect code
- Built with [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- Calendar integration powered by [Google APIs](https://developers.google.com/calendar)

## Support

- 🐛 [Report bugs](https://github.com/sam-silv/bikeshed-action/issues)
- 💡 [Request features](https://github.com/sam-silv/bikeshed-action/issues)
- 📖 [Read the docs](https://github.com/sam-silv/bikeshed-action/wiki)

---

Made with ❤️ for developers who love discussing code