# Leather Workshop R18

## Goal
R18 continues from R17 with three priorities:

1. Material realism
2. Physical surface response
3. Runtime performance

## Scope

- Shared EB lighting adapter entry
- Physically based leather parameter presets
- Optimized shader/material update path
- No replacement of R17 construction assets

## Material targets

### Leather presets

- vegetable tanned leather
- soft leather
- coated leather

Parameters:

- base color
- roughness
- clear coat
- normal micro detail
- edge wear response
- fiber scale

## Performance rules

- no per-frame material reconstruction
- cache uniform updates
- avoid duplicate texture loading
- keep preview interaction smooth

## Validation

R18 must be compared under identical camera and lighting conditions with R17.
