/**
 * 仙侠女 — Blender → glTF → Three.js (r170+)
 *
 * File: models/xianxia-woman.glb  (Y-up, meters-ish Blender units)
 *
 *   import * as THREE from 'three';
 *   import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
 *   import { loadXianxiaWoman } from './xianxia-woman.js';
 *
 *   const woman = await loadXianxiaWoman(THREE, {
 *     GLTFLoader,
 *     url: './models/xianxia-woman.glb',
 *   });
 *   scene.add(woman);
 */
export async function loadXianxiaWoman(THREE, {
  GLTFLoader,
  url = './models/xianxia-woman.glb',
  scale = 1,
  castShadow = true,
  receiveShadow = false,
  /** Shift so the lowest point sits on y = 0 */
  snapToGround = true,
} = {}) {
  if (!GLTFLoader) {
    throw new Error('loadXianxiaWoman: pass GLTFLoader from three/addons/loaders/GLTFLoader.js');
  }

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  root.name = 'XianxiaWoman';
  root.scale.setScalar(scale);

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = castShadow;
    obj.receiveShadow = receiveShadow;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      // Halo / sheer robes
      if (m.transparent || (m.opacity != null && m.opacity < 0.999)) {
        m.depthWrite = false;
      }
    }
  });

  if (snapToGround) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.position.y -= box.min.y;
  }

  root.userData.isCharacter = true;
  root.userData.source = url;
  return root;
}
