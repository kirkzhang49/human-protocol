/**
 * Furniture temporarily pulled out of the /build catalog AND the random-room
 * auto-designer, to shrink the coloring-error surface in deep playtest:
 *   - legacy room_cc0_* furniture: CC0 photogrammetry furniture previously
 *                       hidden for white-material risk in deep cook. Curated
 *                       museum CC0 items are selectively restored after checks.
 *   - 4 museum extras : archive_column / color_orb_pedestal / specimen_plinth /
 *                       wall_label_panel (not placed in any official level; the
 *                       round "specimen_plinth" is one of the reported white props)
 *
 * Kept in /build: the per-level batches (room_lNN_pNN), the furniture actually
 * used by official levels 1-5, and the 4 murals.
 *
 * This does NOT touch GLBs, catalog entries, or propEntry() — already-placed
 * instances still resolve and render. These keys are only filtered out of the
 * asset browser (no new placement) and the auto-designer. Restore an asset by
 * deleting its modelKey from this set.
 */
export const BUILDER_TEMPORARY_HIDDEN_MODEL_KEYS: ReadonlySet<string> = new Set<string>([
  // CC0 photogrammetry furniture
  "room_cc0_armchair",
  "room_cc0_armchair2",
  "room_cc0_barrel",
  "room_cc0_bed",
  "room_cc0_chest",
  "room_cc0_clock",
  "room_cc0_coffee_table",
  "room_cc0_console",
  "room_cc0_horse",
  "room_cc0_lantern",
  "room_cc0_plant",
  "room_cc0_plant2",
  "room_cc0_shelf",
  "room_cc0_sofa",
  "room_cc0_sofa2",
  "room_cc0_tv",
  "room_cc0_wood_table",
  // Ceiling fixture is registered for already-authored drafts, but hidden from
  // new placement; ceiling lighting now comes from invisible practical lights.
  "room_cc0_chandelier_02_ceiling",
  // museum props not placed in any official level
  "room_museum_archive_column",
  "room_museum_color_orb_pedestal",
  "room_museum_specimen_plinth",
  "room_museum_wall_label_panel",
  // Image2 remaster furniture (official-level look) — pulled from /build per
  // request for the earlier locked batches. Placed instances still resolve +
  // render. Level 2 residential and the Level 4-5 planning packs stay visible
  // as the current curated authoring sets.
  "room_l1_img2_battery_cart",
  "room_l1_img2_ceiling_service_light",
  "room_l1_img2_diagnostic_locker",
  "room_l1_img2_folded_gurney",
  "room_l1_img2_parts_cabinet",
  "room_l1_img2_repair_workbench",
  "room_l1_img2_service_stool",
  "room_l1_img2_utility_crate",
  "room_l3_img2_archive_card_cabinet",
  "room_l3_img2_display_plinth",
  "room_l3_img2_evidence_round_table",
  "room_l3_img2_label_terminal",
  "room_l3_img2_mural_lightbox",
  "room_l3_img2_preservation_case",
  "room_l3_img2_queue_rail",
  "room_l3_img2_specimen_bench",
  // Level 4 legacy platform gates: kept for already-authored drafts, but new
  // gate authoring should use wall-mounted interaction devices instead.
  "hp_l4_cineclinic_decon_gate",
  "hp_l4_cineclinic_sedation_gate",
]);

export function isBuilderTemporarilyHidden(modelKey: string): boolean {
  return BUILDER_TEMPORARY_HIDDEN_MODEL_KEYS.has(modelKey);
}
