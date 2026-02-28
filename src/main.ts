import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import './style.css';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONFIGURATION — only edit this section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BASE_MODEL = '/model_idle.fbx';

const BUTTONS: AnimationButton[] = [
    {
        label: 'Drive',
        sequence: ['/golf_setup.fbx', '/golf_drive.fbx'],
    },
    {
        label: 'Swing',
        sequence: ['/golf_setup.fbx', '/golf_swing.fbx'],
    },
    {
        label: 'Putt',
        sequence: ['/golf_setup.fbx', '/golf_putt.fbx'],
    },
    {
        label: 'Chip',
        sequence: ['/golf_setup.fbx', '/golf_chip.fbx'],
    },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AnimationButton {
    label: string;
    sequence: string[];
    loop?: boolean;
    fadeIn?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  THREE.JS SETUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const container = document.getElementById('viewer')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 10, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

function resizeRenderer(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
resizeRenderer();
window.addEventListener('resize', resizeRenderer);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
(dirLight.shadow.camera as THREE.OrthographicCamera).left = -50;
(dirLight.shadow.camera as THREE.OrthographicCamera).right = 50;
(dirLight.shadow.camera as THREE.OrthographicCamera).top = 50;
(dirLight.shadow.camera as THREE.OrthographicCamera).bottom = -50;
scene.add(dirLight);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x16213e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2;
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ANIMATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const loader = new FBXLoader();
const clock = new THREE.Clock();

let rootModel: THREE.Group | null = null;
let mixer: THREE.AnimationMixer | null = null;
let currentAction: THREE.AnimationAction | null = null;
let idleClip: THREE.AnimationClip | null = null;
let activePair: HTMLButtonElement[] = [];
let sequenceToken = 0;

const clipCache = new Map<string, THREE.AnimationClip>();

function preloadClip(file: string): Promise<THREE.AnimationClip> {
    if (clipCache.has(file)) return Promise.resolve(clipCache.get(file)!);
    return new Promise((resolve, reject) => {
        loader.load(
            file,
            (fbx: THREE.Group) => {
                const clip = fbx.animations[0];
                if (!clip) { reject(new Error(`No animation in ${file}`)); return; }
                clipCache.set(file, clip);
                resolve(clip);
            },
            undefined,
            reject
        );
    });
}

function resetMixer(): void {
    if (!rootModel) return;
    if (mixer) mixer.stopAllAction();
    mixer = new THREE.AnimationMixer(rootModel);
    currentAction = null;
}

function crossfadeTo(clip: THREE.AnimationClip, fadeDuration = 0.3): THREE.AnimationAction {
    if (!mixer || !rootModel) throw new Error('Mixer not ready');
    const next = mixer.clipAction(clip, rootModel);
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (currentAction && currentAction !== next) {
        currentAction.crossFadeTo(next, fadeDuration, true);
    }
    currentAction = next;
    return next;
}

function playIdle(): void {
    if (!idleClip || !mixer || !rootModel) return;
    sequenceToken++;
    clearActiveBtn();
    const action = crossfadeTo(idleClip, 0.6);
    action.setLoop(THREE.LoopRepeat, Infinity);
}

function playSequence(button: AnimationButton, btn: HTMLButtonElement, pair?: HTMLButtonElement[]): void {
    const clips = button.sequence.map((f) => clipCache.get(f));
    if (clips.some((c) => !c)) {
        console.warn('Clips not loaded yet — try again in a moment.');
        return;
    }

    sequenceToken++;
    const myToken = sequenceToken;
    resetMixer();
    setActiveBtn(btn, pair);

    let index = 0;

    const playNext = (): void => {
        if (myToken !== sequenceToken) return;

        if (index >= clips.length) {
            if (button.loop) { index = 0; playNext(); }
            else { playIdle(); }
            return;
        }

        const clip = clips[index]!;
        const fadeDuration = index === 0 ? (button.fadeIn ?? 0.3) : 0.2;
        const action = crossfadeTo(clip, fadeDuration);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        index++;

        const onFinished = (e: THREE.Event): void => {
            const event = e as unknown as { action: THREE.AnimationAction };
            if (event.action !== action) return;
            mixer!.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
            playNext();
        };
        mixer!.addEventListener('finished', onFinished as (e: THREE.Event) => void);
    };

    playNext();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LOAD BASE MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const overlay = createLoadingOverlay();

loader.load(
    BASE_MODEL,

    (fbx: THREE.Group) => {
        fbx.scale.setScalar(0.2);
        fbx.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.visible = true;
                const fixMaterial = (m: THREE.Material) => {
                    m.side = THREE.FrontSide;
                    m.transparent = false;
                    m.opacity = 1;
                    (m as any).alphaTest = 0;
                    m.needsUpdate = true;
                };
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(fixMaterial);
                } else if (mesh.material) {
                    fixMaterial(mesh.material as THREE.Material);
                }
            }
        });

        const box = new THREE.Box3().setFromObject(fbx);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        fbx.position.x -= center.x;
        fbx.position.z -= center.z;
        fbx.position.y -= box.min.y;

        scene.add(fbx);
        rootModel = fbx;
        mixer = new THREE.AnimationMixer(fbx);

        if (fbx.animations.length > 0) {
            idleClip = fbx.animations[0];
            currentAction = mixer.clipAction(idleClip);
            currentAction.setLoop(THREE.LoopRepeat, Infinity);
            currentAction.play();
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, size.y * 0.5, maxDim * 1.8);
        controls.target.set(0, size.y * 0.4, 0);
        controls.update();

        BUTTONS.forEach((b) => b.sequence.forEach(preloadClip));

        removeOverlay(overlay);
        buildUI();
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RENDER LOOP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setActiveBtn(btn: HTMLButtonElement, pair?: HTMLButtonElement[]): void {
    clearActiveBtn();
    activePair = pair ?? [btn];
    activePair.forEach((b) => b.classList.add('active'));
}

function clearActiveBtn(): void {
    activePair.forEach((b) => b.classList.remove('active'));
    activePair = [];
}

function createLoadingOverlay(): HTMLDivElement {
    const div = document.createElement('div');
    div.id = 'loader';
    div.innerHTML = `<div class="spinner"></div><p id="load-pct">Loading...</p>`;
    container.appendChild(div);
    return div;
}

function removeOverlay(el: HTMLElement): void {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
}

function buildUI(): void {
    const mobileUi = document.getElementById('anim-ui')!;
    const desktopUi = document.getElementById('anim-ui-desktop')!;

    BUTTONS.forEach((config) => {
        const pair: HTMLButtonElement[] = [];

        [mobileUi, desktopUi].forEach((ui) => {
            const btn = document.createElement('button');
            btn.textContent = config.label;
            btn.addEventListener('click', () => playSequence(config, btn, pair));
            pair.push(btn);
            ui.appendChild(btn);
        });
    });
}