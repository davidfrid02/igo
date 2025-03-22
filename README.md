# iGo

An intelligent VS Code extension that enhances Go development with smart interface navigation, implementation tracking, and string formatting features.

## Features

### 1. Smart Interface Navigation

- Shows implementation count next to interface definitions
- Hover over interfaces to see:
  - Required methods
  - List of implementing types
  - File paths for each implementation
- Click on implementations to navigate directly to the code

### 2. Method Navigation

- Hover over methods to see which interfaces require them
- Click on interface names to navigate to their definitions
- Click on implementation types to navigate to their method definitions

### 3. Smart String Formatting

- Automatically breaks long Go strings with the `+` operator
- Maintains proper indentation
- Triggered by pressing Enter while inside a string

## Installation

1. Open VS Code
2. Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (macOS)
3. Type `ext install davidfried.igo`
4. Press Enter

## Usage

### Interface Navigation

1. Open a Go file containing interfaces
2. Look for the implementation count (●) next to interface definitions
3. Hover over an interface to see its methods and implementations
4. Click on any implementation to navigate to its code

### Method Navigation

1. Hover over a method implementation
2. See which interfaces require this method
3. Click on interface names to navigate to their definitions

## Requirements

- VS Code 1.85.0 or higher
- Go language support

## Extension Settings

This extension contributes the following settings:

- None currently - the extension works out of the box!

## Known Issues

Please report any issues on our [GitHub repository](https://github.com/davidfried/golang-string-break/issues).

## Release Notes

### 0.1.0

Initial release:

- String breaking functionality
- Interface implementation tracking
- Method and interface navigation
- Hover information for interfaces and methods

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).
