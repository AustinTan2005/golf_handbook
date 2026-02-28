import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 10, 30);

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Lights ──────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 200;
(dirLight.shadow.camera as THREE.OrthographicCamera).left = -50;
(dirLight.shadow.camera as THREE.OrthographicCamera).right = 50;
(dirLight.shadow.camera as THREE.OrthographicCamera).top = 50;
(dirLight.shadow.camera as THREE.OrthographicCamera).bottom = -50;
scene.add(dirLight);

// ─── Ground ──────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x16213e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ─── Orbit Controls ──────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2;

// ─── Animation Mixer ─────────────────────────────────────────────────────────
let mixer: THREE.AnimationMixer | null = null;
const clock = new THREE.Clock();

// ─── FBX Loader ──────────────────────────────────────────────────────────────
const loader = new FBXLoader();
const overlay = createLoadingOverlay();

loader.load(
    '/elmo.fbx',

    (fbx: THREE.Group) => {
        fbx.scale.setScalar(0.1);

        fbx.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });

        // Center model above ground
        const box = new THREE.Box3().setFromObject(fbx);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        fbx.position.x -= center.x;
        fbx.position.z -= center.z;
        fbx.position.y -= box.min.y;

        scene.add(fbx);

        // Animations
        if (fbx.animations?.length > 0) {
            mixer = new THREE.AnimationMixer(fbx);
            mixer.clipAction(fbx.animations[0]).play();
            if (fbx.animations.length > 1) {
                buildAnimationUI(fbx.animations, mixer);
            }
        }

        // Fit camera to model size
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, maxDim * 0.8, maxDim * 2);
        controls.target.set(0, size.y / 2, 0);
        controls.update();

        removeOverlay(overlay);
    },

    (xhr: ProgressEvent) => {
        if (xhr.lengthComputable) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            const el = overlay.querySelector('#load-pct');
            if (el) el.textContent = `${pct}%`;
        }
    },

    (err: unknown) => {
        console.error('FBX load error:', err);
        const el = overlay.querySelector('#load-pct');
        if (el) el.textContent = 'Failed to load model';
    }
);

// ─── Render Loop ─────────────────────────────────────────────────────────────
function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── UI Helpers ──────────────────────────────────────────────────────────────
function createLoadingOverlay(): HTMLDivElement {
    const div = document.createElement('div');
    div.id = 'loader';
    div.innerHTML = `<div class="spinner"></div><p id="load-pct">Loading...</p>`;
    document.body.appendChild(div);
    return div;
}

function removeOverlay(el: HTMLElement): void {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
}

function buildAnimationUI(
    animations: THREE.AnimationClip[],
    mixer: THREE.AnimationMixer
): void {
    const ui = document.createElement('div');
    ui.id = 'anim-ui';
    ui.innerHTML = '<strong>Animations</strong>';

    animations.forEach((clip: THREE.AnimationClip, i: number) => {
        const btn = document.createElement('button');
        btn.textContent = clip.name || `Clip ${i + 1}`;
        btn.addEventListener('click', () => {
            mixer.stopAllAction();
            mixer.clipAction(clip).play();
            ui.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
        if (i === 0) btn.classList.add('active');
        ui.appendChild(btn);
    });

    document.body.appendChild(ui);
}