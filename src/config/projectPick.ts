import { ProjectInfo } from '../api/types';
import { ProjectRef } from './projectConfig';

/** 목록 끝에 두는, "owner/name"을 직접 입력하는 항목의 라벨이다. */
export const MANUAL_ENTRY_LABEL = '$(edit) 직접 입력...';

/** 빠른 선택 목록의 한 항목이다. `ref`가 없으면 직접 입력 항목이다. */
export interface ProjectPickItem {
  label: string;
  description?: string;
  ref?: ProjectRef;
}

/**
 * 프로젝트 등록 때 보일 선택 항목을 만든다. 내가 속한 프로젝트 가운데 아직 등록하지 않은 것만 담고,
 * 끝에 직접 입력 항목을 붙인다. 고를 프로젝트가 없으면 빈 배열이다.
 */
export function projectPickItems(candidates: ProjectInfo[], registered: ProjectRef[]): ProjectPickItem[] {
  const has = new Set(registered.map((p) => `${p.owner}/${p.name}`));
  const items: ProjectPickItem[] = candidates
    .filter((p) => !has.has(`${p.owner}/${p.name}`))
    .map((p) => ({ label: `${p.owner}/${p.name}`, description: p.overview, ref: { owner: p.owner, name: p.name } }));
  return items.length === 0 ? [] : [...items, { label: MANUAL_ENTRY_LABEL }];
}
