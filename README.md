# Persistent Damage & Afflictions — v0.1.0 (initial build)

**Foundry v14 / D&D 5e v6.1.1. Standalone; no Midi-QOL.**

## Install
Extract ZIP into your Foundry user data `Data/modules/` directory, or host the ZIP and module manifest for remote installation. On The Forge, upload the extracted module as a custom module using its module management workflow. This ZIP is not yet published to GitHub.

## Usage
As GM, select a token and run this script macro:
```js
await game.persistentAfflictions.showActor(canvas.tokens.controlled[0].actor);
```
Or access the token controls button if available. The GM panel supports adding, stepping and resolving effects. Combat-turn start resolution uses the `updateCombat` hook. Set auto HP subtraction in Game Settings (off by default).

To configure a weapon or spell item, open its item sheet and select **Persistent Affliction Settings**. Configuration is saved but hit-trigger automation is **not implemented**; use the GM panel to apply it after a confirmed hit. To import the spell reference catalog, run:
```js
await game.persistentAfflictions.importCatalog();
```
The importer creates **world compendium reference entries** with spell names and levels, not fully authored/automated spells. Consult the source PDF for descriptions.

## Implemented
- Eight conditions, one Active Effect per condition per actor, reapplication increases die, d12 overflow, GM controls.
- Start-of-turn persistent damage rolls, automatic step-down, optional direct HP subtraction.
- Immediate damage for Burning and Laceration overflow; text notifications and overflow counters for other conditions.
- Corrosion overflow scar counter stored on actor (does not yet automatically modify AC).
- Spell reference catalog importer (names and levels only).

## Not yet implemented (important)
- Full overflow penalty automation, including roll modifiers, speed, reaction restrictions, AC modification, and timed expiration.
- Automatic weapon/spell hit detection, native activity integration, and all spell special interactions.
- Spell compendium with full descriptions, activities, targets, scaling, or automated damage.
- Damage application through D&D 5e's damage pipeline (direct HP adjustment is optional and does not calculate resistances, immunities, temp HP, or concentration).
- Robust multi-GM race protection and cross-combat reset logic.

**This is an initial test build, not a finished rules-complete release.** Back up your world before testing. Do not enable auto HP subtraction in a production game without testing it first.
