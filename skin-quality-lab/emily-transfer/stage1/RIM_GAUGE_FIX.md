# Under-view rim correction

The stronger underside camera found an additional defect during partial closure: the anterior free edge moved towards its closed rest surface, while the central posterior edge stayed on the globe. This exposed a multi-millimetre dark ribbon even though the closed endpoints and collision checks passed.

The posterior edge now follows the anterior edge with a bounded axial gauge: upper0.45mm, lower0.22mm, tapered corner0.16mm (design constraints, not medical measurements). Deeper posterior rows smoothly return to their existing contact chart. Every part remains real geometry; no eye or strip is hidden and no dark/skin cover object is added.

`maxMarginAxialThicknessMM` is measured from actual vertices, not copied from a preset. The steep-camera transition regression requires this maximum to stay below0.451mm, together with zero tested outer-globe penetrations. Full posterior triangle and shared-edge regressions are retained.

This corrects the exposed rim band, not the entire anatomical lid cross-section. Person-specific anatomy and volume/arc-length conserving tissue dynamics remain outside this first-stage patch.
