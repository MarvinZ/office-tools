// Who may see / change a collection within one family (spec §3). Cross-family access never
// reaches these checks: collectors are always looked up with the caller's tenant id first.

export type Viewer = { collectorId: string; isParent: boolean };
export type CollectionOwner = { id: string; isPrivate: boolean };

export function canReadCollection(viewer: Viewer, owner: CollectionOwner): boolean {
  return viewer.isParent || viewer.collectorId === owner.id || !owner.isPrivate;
}

export function canWriteCollection(viewer: Viewer, owner: CollectionOwner): boolean {
  return viewer.isParent || viewer.collectorId === owner.id;
}
