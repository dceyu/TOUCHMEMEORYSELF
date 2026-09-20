import { describe,expect,it } from 'vitest';
import { createDefaultProject } from './defaults';

describe('project defaults',()=>{
  it('persists bilingual UI, ambient field and quantum settings',()=>{const project=createDefaultProject();expect(project.ui.language).toBe('zh');expect(project.quantum.pointSize).toBeGreaterThan(0);expect(project.ambient.force).toBeGreaterThan(0);expect(JSON.parse(JSON.stringify(project)).ambient).toEqual(project.ambient);});
});
