// cover-context.jsx — shared context for cover image URLs.
// Loaded first so all other components can access window.CoverContext.
// Provides default (empty) values; SihwaFull overrides with real state.

const _coverDefaults = { app: '', front: '', back: '', set: () => {} };
const CoverContext = React.createContext(_coverDefaults);

Object.assign(window, { CoverContext });
