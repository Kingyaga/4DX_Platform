import { Prisma } from "@/generated/prisma/client";

export type SessionSnapshotInput = {
  team: {
    id: string;
    name: string;
    slug: string;
  };
  wig: {
    id: string;
    title: string;
    description?: string | null;
    trackingType: string;
    fromValue?: number | null;
    toValue?: number | null;
    currentValue?: number | null;
    unit?: string | null;
    deadline: Date;
    leadMeasures?: Array<{
      id: string;
      name: string;
      description?: string | null;
      trackingType: string;
      cadence: string;
      targetValue?: number | null;
      unit?: string | null;
    }>;
  };
};

export function buildWeeklySessionSnapshot({
  team,
  wig,
}: SessionSnapshotInput): Prisma.InputJsonValue {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
    },
    wig: {
      id: wig.id,
      title: wig.title,
      description: wig.description ?? null,
      trackingType: wig.trackingType,
      fromValue: wig.fromValue ?? null,
      toValue: wig.toValue ?? null,
      currentValue: wig.currentValue ?? null,
      unit: wig.unit ?? null,
      deadline: wig.deadline.toISOString(),
      leadMeasures: (wig.leadMeasures ?? []).map((leadMeasure) => ({
        id: leadMeasure.id,
        name: leadMeasure.name,
        description: leadMeasure.description ?? null,
        trackingType: leadMeasure.trackingType,
        cadence: leadMeasure.cadence,
        targetValue: leadMeasure.targetValue ?? null,
        unit: leadMeasure.unit ?? null,
      })),
    },
  };
}
