export type PlayLayerSide = "above" | "below";

export type PlayLayerNode = {
  id: string;
  label: string;
  kind: string;
  side: PlayLayerSide;
  detail: string | null;
  relationshipType: string | null;
};

export type PlayTimeAnchor = {
  id: string;
  label: string;
  kind: "episode" | "scene" | "beat" | "event";
  time: number | null;
  chronologyIndex: number;
  summary: string | null;
  layers: PlayLayerNode[];
};

export type PlayModeGraph = {
  transcriptId: string;
  episode: {
    id: string;
    title: string;
    summary: string | null;
  };
  anchors: PlayTimeAnchor[];
};
