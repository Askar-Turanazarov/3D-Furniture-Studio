// Shared materials for the room and furniture.
import * as THREE from 'three';

let mats = null;

export function getMats() {
  if (mats) return mats;
  mats = {
    floor: new THREE.MeshStandardMaterial({ color: '#b98a5b', roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
    plinth: new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.5 }),
    frame: new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25 }),
    sky: new THREE.MeshBasicMaterial({ color: '#bfe3ff' }),
    door: new THREE.MeshStandardMaterial({ color: '#d9c7ad', roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c0c4cc', roughness: 0.3, metalness: 0.9 })
  };
  return mats;
}
