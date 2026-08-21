# Character Studio Panels

This folder contains the left-column Character Studio editor only. It does not create a page shell or a Three.js viewport.

Mount it from the Shell entry after the Shell has created its existing `ProjectHubClient`:

```js
import { mountCharacterStudioSidebar } from './apps/character-studio/index.js';
import './apps/character-studio/character-studio.css';

const characterSidebar = mountCharacterStudioSidebar({
  root: document.querySelector('[data-character-studio-sidebar]'),
  hub,
});
```

The Shell only needs to provide one element with `data-character-studio-sidebar` and the shared ProjectHub-compatible client. The sidebar subscribes to ProjectState changes and writes through existing Character Core and module actions.
