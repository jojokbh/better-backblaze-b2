# Development Workflow

This document describes the development workflow for the Backblaze B2 Node.js library.

## Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Available Scripts

### Development
- `npm run dev` - Build in watch mode for development
- `npm run build:watch` - Alias for dev command
- `npm run clean` - Remove build artifacts and coverage reports

### Building
- `npm run build` - Build the library for production
- `npm run type-check` - Run TypeScript type checking

### Testing
- `npm test` - Run all tests once
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:coverage:unit` - Run unit tests with coverage

### Code Quality
- `npm run lint` - Lint source code
- `npm run lint:fix` - Lint and auto-fix source code
- `npm run lint:test` - Lint and auto-fix test files
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Validation & CI
- `npm run validate` - Run type checking, linting, and format checking
- `npm run ci` - Full CI pipeline (clean, validate, build, test unit)

## Development Workflow

### 1. Making Changes
1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run validate` to check code quality
4. Run `npm run test:unit` to ensure tests pass
5. Commit your changes

### 2. Before Committing
Always run the validation pipeline:
```bash
npm run validate
```

This will:
- Check TypeScript types
- Lint the code
- Check code formatting

### 3. Testing
Run unit tests during development:
```bash
npm run test:unit
```

For integration tests (requires B2 credentials):
```bash
npm run test:integration
```

### 4. Building
Build the library:
```bash
npm run build
```

This creates:
- `dist/index.js` - ES module build
- `dist/index.cjs` - CommonJS build
- `dist/types/index.d.ts` - TypeScript definitions

## Code Quality Standards

### ESLint Configuration
- Uses modern ESLint flat config format
- Extends recommended rules for JavaScript and TypeScript
- Integrates with Prettier for formatting
- Special rules for test files and TypeScript definitions

### Prettier Configuration
- Semi-colons: enabled
- Single quotes: enabled
- Trailing commas: ES5 compatible
- Print width: 80 characters
- Tab width: 2 spaces

### TypeScript
- Strict mode enabled
- ES2020 target
- ESNext modules
- Declaration files generated

## Build Tools

### Vite
- Fast development builds with watch mode
- Production builds with minification and source maps
- Dual format output (ES modules and CommonJS)
- TypeScript definitions copying

### Vitest
- Fast test runner with native ES modules support
- Built-in coverage reporting with v8
- Watch mode for development
- Separate unit and integration test suites

## CI/CD Pipeline

The `npm run ci` command runs the complete CI pipeline:
1. Clean previous builds
2. Validate code quality (types, linting, formatting)
3. Build the library
4. Run unit tests

For publishing:
```bash
npm run prepublishOnly
```

This runs the CI pipeline plus coverage reporting.

## File Structure

```
src/                    # Source code
├── core/              # Core functionality (HTTP, retry, error handling)
├── managers/          # API managers (auth, bucket, file, key)
├── utils/             # Utility functions
├── types/             # TypeScript definitions
├── constants.js       # API constants
├── b2-client.js      # Main client class
└── index.js          # Entry point

test/                  # Test files
├── unit/             # Unit tests
├── integration/      # Integration tests
└── types/            # TypeScript type tests

dist/                 # Built files (generated)
coverage/             # Coverage reports (generated)
```

## Environment Variables

For integration tests, set these environment variables:
- `B2_APPLICATION_KEY_ID` - Your B2 application key ID
- `B2_APPLICATION_KEY` - Your B2 application key
- `B2_TEST_BUCKET_NAME` - Name of test bucket to use

## Troubleshooting

### TypeScript Version Warning
If you see warnings about TypeScript version compatibility with ESLint, this is expected. The library works with newer TypeScript versions despite the warning.

### Integration Test Failures
Integration tests require valid B2 credentials and may fail if:
- Credentials are not set
- Network connectivity issues
- B2 service is unavailable
- Rate limiting is encountered

### Build Issues
If builds fail:
1. Run `npm run clean` to remove old artifacts
2. Check that all dependencies are installed
3. Ensure Node.js version is 18.0.0 or higher