# VS Code Style Diff Viewer

A professional text/code comparison tool built with React, TypeScript, and Vite that replicates the Visual Studio Code diff view experience.

## Features

- 🎨 **VS Code Dark Theme**: Authentic Visual Studio Code dark theme styling
- 🔀 **Split & Unified Views**: Toggle between side-by-side and unified diff views
- 🎯 **Syntax Highlighting**: Support for JavaScript, TypeScript, JSX, TSX, CSS, and JSON
- 📊 **Diff Statistics**: Real-time addition and deletion counters
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- ⚡ **Real-time Diffing**: Instant comparison as you type or paste code
- 🎨 **Color-coded Changes**:
  - Green highlights for additions
  - Red highlights for deletions
  - Gray for unchanged lines

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd <project-directory>
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic Usage

1. **Paste or type code** in the "Original" (left) textarea
2. **Paste or type modified code** in the "Modified" (right) textarea
3. The diff viewer below will automatically show the differences

### View Modes

- **Split View** (default): Shows original and modified code side-by-side
- **Unified View**: Shows changes in a single column with +/- markers

### Language Selection

Select the appropriate language from the dropdown menu for accurate syntax highlighting:

- JavaScript
- TypeScript
- JSX
- TSX
- CSS
- JSON
- Plain Text

### Controls

- **Clear Button**: Clears the content of each input area
- **View Toggle**: Switch between split and unified views
- **Statistics**: View the number of additions and deletions in real-time

## Project Structure

```
src/
├── components/
│   └── DiffViewer/
│       ├── DiffViewer.tsx      # Main component logic
│       ├── DiffViewer.css      # VS Code themed styles
│       ├── types.ts            # TypeScript type definitions
│       └── index.ts            # Component exports
├── styles/
│   └── prism-vsc-dark-plus.css # VS Code syntax highlighting theme
├── App.tsx                      # Main app component
├── App.css                      # App-level styles
├── index.css                    # Global styles
└── main.tsx                     # Application entry point
```

## Technologies Used

- **React 18**: UI library
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool
- **diff**: Text comparison library
- **Prism.js**: Syntax highlighting
- **clsx**: Conditional CSS classes

## Keyboard Shortcuts

- `Ctrl/Cmd + V`: Paste content into input areas
- `Tab`: Navigate between controls
- `Escape`: Clear focus from inputs

## Performance Optimizations

- Memoized diff calculations using `useMemo`
- Efficient line-by-line diffing algorithm
- Lazy syntax highlighting
- Optimized re-renders with React hooks

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Visual Studio Code for the design inspiration
- Prism.js for syntax highlighting capabilities
- The diff library for robust text comparison algorithms
