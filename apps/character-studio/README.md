# Character Studio v1

This folder contains the Character Studio v1 page runtime: the three-column shell, nine left-column panels, the single simulationRig viewport host, the right-column revision/export summary, the shared session, and persistence adapters.

Mount it from the Shell entry after the Shell has created its existing `ProjectHubClient`:

```js
import { mountCharacterStudioSidebar } from './apps/character-studio/index.js';
import './apps/character-studio/character-studio.css';

const characterSidebar = mountCharacterStudioSidebar({
  root: document.querySelector('[data-character-studio-sidebar]'),
  hub,
});
```

The page entry creates one ProjectHub-compatible client and passes that same instance to the sidebar and Character Studio session. The sidebar subscribes to ProjectState changes and writes through existing Character Core and module actions; it does not create an independent Character state.
