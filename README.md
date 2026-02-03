# ReelRater

A React Native movie rating application built with Expo Router.

## Overview

ReelRater is a mobile application that allows users to rate and review movies. Built with React Native and Expo, it provides a cross-platform experience for iOS and Android.

## Features

- User authentication (login/signup)
- Movie browsing and discovery
- User reviews and ratings
- Profile management
- Cross-platform support (iOS/Android)

## Tech Stack

- **Framework**: React Native 0.81.5
- **Navigation**: Expo Router 6.0.22
- **UI Components**: React Navigation
- **Runtime**: Expo 54.0.32
- **Language**: TypeScript 5.9.2

## Getting Started

### Prerequisites

- Node.js (recommended: latest LTS version)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Studio (for Android development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/joepangallo/ReelRater.git
cd ReelRater
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Running the App

- **iOS**:
```bash
npm run ios
```

- **Android**:
```bash
npm run android
```

## Project Structure

```
ReelRater/
├── app/              # Application screens and routes
│   ├── index.tsx     # Home screen
│   ├── login.tsx     # Login screen
│   ├── signup.tsx    # Signup screen
│   ├── profile.tsx   # User profile
│   └── reviews.tsx   # Reviews screen
├── assets/           # Images, fonts, and other static files
├── android/          # Android native code
├── ios/              # iOS native code
└── build/            # Compiled code
```

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run build` - Build the project
- `npm test` - Run tests
- `npm run lint` - Run linter

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Documentation

For more information about Expo Router, check out the [official documentation](https://docs.expo.dev/routing/introduction/).

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/joepangallo/ReelRater/issues) page.
