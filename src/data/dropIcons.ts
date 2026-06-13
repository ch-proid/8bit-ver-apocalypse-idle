import type { DropIconKind, ItemSlot } from "../core/types";

export type DropIconSheetId = "drop01" | "drop02";
export type DropIconId = DropIconKind;

export interface DropIconSheet {
  path: string;
  frameSize: number;
  columns: number;
}

export interface DropIconFrame {
  sheet: DropIconSheetId;
  frameIndex: number;
}

export const DROP_ICON_SHEETS: Record<DropIconSheetId, DropIconSheet> = {
  drop01: {
    path: "/assets/icons/Drop01.png",
    frameSize: 8,
    columns: 2,
  },
  drop02: {
    path: "/assets/icons/Drop02.png",
    frameSize: 8,
    columns: 2,
  },
};

export const DROP_ICON_FRAMES: Record<DropIconId, DropIconFrame> = {
  gold: { sheet: "drop01", frameIndex: 0 },
  blood: { sheet: "drop01", frameIndex: 1 },
  ability: { sheet: "drop01", frameIndex: 2 },
  heal: { sheet: "drop01", frameIndex: 3 },
  weapon: { sheet: "drop02", frameIndex: 0 },
  helmet: { sheet: "drop02", frameIndex: 1 },
  armor: { sheet: "drop02", frameIndex: 2 },
  accessory: { sheet: "drop02", frameIndex: 3 },
};

export const DROP_ICON_FOR_EQUIPMENT_SLOT: Record<ItemSlot, DropIconId> = {
  weapon: "weapon",
  helmet: "helmet",
  armor: "armor",
  accessory: "accessory",
};
