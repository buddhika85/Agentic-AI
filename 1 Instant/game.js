import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const playerHealthEl = document.getElementById("playerHealth");
const enemyHealthEl = document.getElementById("enemyHealth");
const playerHealthBarEl = document.getElementById("playerHealthBar");
const enemyHealthBarEl = document.getElementById("enemyHealthBar");
const enemyDistanceEl = document.getElementById("enemyDistance");
const weaponStateEl = document.getElementById("weaponState");
const shotsLandedEl = document.getElementById("shotsLanded");
const shotsFiredEl = document.getElementById("shotsFired");
const statusTextEl = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151923);
scene.fog = new THREE.Fog(0x151923, 15, 85);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(18, 30, 8);
sun.castShadow = true;
scene.add(sun);

const arenaSize = 44;
const wallHeight = 6;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaSize, arenaSize, 10, 10),
  new THREE.MeshStandardMaterial({
    color: 0x2b3443,
    metalness: 0.2,
    roughness: 0.95,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a5568,
  metalness: 0.1,
  roughness: 0.8,
});

function addWall(x, z, width, depth) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    wallMaterial
  );
  wall.position.set(x, wallHeight / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

const half = arenaSize / 2;
const wallThickness = 1.3;

addWall(0, -half, arenaSize, wallThickness);
addWall(0, half, arenaSize, wallThickness);
addWall(-half, 0, wallThickness, arenaSize);
addWall(half, 0, wallThickness, arenaSize);

const columns = [];
for (let i = 0; i < 8; i += 1) {
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 4, 20),
    new THREE.MeshStandardMaterial({ color: 0x3f4c5f })
  );
  col.position.set((Math.random() - 0.5) * 30, 2, (Math.random() - 0.5) * 30);
  col.castShadow = true;
  col.receiveShadow = true;
  columns.push(col);
  scene.add(col);
}

const player = {
  position: new THREE.Vector3(0, 1.6, 16),
  yaw: Math.PI,
  speed: 9,
  turnSpeed: 2.3,
  health: 90,
};

camera.position.copy(player.position);
camera.rotation.order = "YXZ";

function setCastReceiveShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

function setBaseColor(mesh, color) {
  mesh.userData.baseColor = color;
}

function createEnemyMesh() {
  const enemyGroup = new THREE.Group();

  const armorMaterial = new THREE.MeshStandardMaterial({
    color: 0xb51f2a,
    metalness: 0.35,
    roughness: 0.55,
  });
  const blackMaterial = new THREE.MeshStandardMaterial({
    color: 0x11131a,
    metalness: 0.45,
    roughness: 0.45,
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x44f0ff,
    emissive: 0x0a4b52,
    metalness: 0.15,
    roughness: 0.2,
  });

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.4, 0.75),
    armorMaterial
  );
  torso.position.set(0, 1.25, 0);
  setCastReceiveShadow(torso);
  setBaseColor(torso, 0xb51f2a);
  enemyGroup.add(torso);

  const chestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.7, 0.15),
    blackMaterial
  );
  chestPlate.position.set(0, 1.22, 0.44);
  setCastReceiveShadow(chestPlate);
  setBaseColor(chestPlate, 0x11131a);
  enemyGroup.add(chestPlate);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 0.65),
    blackMaterial
  );
  head.position.set(0, 2.3, 0);
  setCastReceiveShadow(head);
  setBaseColor(head, 0x11131a);
  enemyGroup.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.1),
    visorMaterial
  );
  visor.position.set(0, 2.3, 0.37);
  setCastReceiveShadow(visor);
  enemyGroup.add(visor);

  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.0, 0.3),
    armorMaterial
  );
  leftArm.position.set(-0.8, 1.2, 0);
  setCastReceiveShadow(leftArm);
  setBaseColor(leftArm, 0xb51f2a);
  enemyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.0, 0.3),
    armorMaterial
  );
  rightArm.position.set(0.8, 1.2, 0);
  setCastReceiveShadow(rightArm);
  setBaseColor(rightArm, 0xb51f2a);
  enemyGroup.add(rightArm);

  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 1.0, 0.36),
    blackMaterial
  );
  leftLeg.position.set(-0.3, 0.28, 0);
  setCastReceiveShadow(leftLeg);
  setBaseColor(leftLeg, 0x11131a);
  enemyGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 1.0, 0.36),
    blackMaterial
  );
  rightLeg.position.set(0.3, 0.28, 0);
  setCastReceiveShadow(rightLeg);
  setBaseColor(rightLeg, 0x11131a);
  enemyGroup.add(rightLeg);

  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.18, 0.2),
    blackMaterial
  );
  weapon.position.set(0.62, 1.02, 0.45);
  setCastReceiveShadow(weapon);
  setBaseColor(weapon, 0x11131a);
  enemyGroup.add(weapon);

  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.4, 8),
    armorMaterial
  );
  spike.position.set(0, 2.75, 0);
  setCastReceiveShadow(spike);
  setBaseColor(spike, 0xb51f2a);
  enemyGroup.add(spike);

  enemyGroup.userData.defaultArmorColor = 0xb51f2a;
  enemyGroup.userData.defaultVisorEmissive = 0x0a4b52;

  return enemyGroup;
}

function setEnemyAlertColor(mesh) {
  mesh.traverse((part) => {
    if (!part.isMesh) {
      return;
    }
    if (part.material.emissive) {
      part.material.emissive.set(0x350f12);
    } else {
      const baseColor = part.userData.baseColor ?? 0xb51f2a;
      const flashed = new THREE.Color(baseColor).lerp(
        new THREE.Color(0xffffff),
        0.45
      );
      part.material.color.copy(flashed);
    }
  });
}

function resetEnemyColor(mesh) {
  mesh.traverse((part) => {
    if (!part.isMesh) {
      return;
    }
    if (part.material.emissive) {
      part.material.emissive.set(mesh.userData.defaultVisorEmissive);
    } else if (part.userData.baseColor !== undefined) {
      part.material.color.set(part.userData.baseColor);
    }
  });
}

const enemy = {
  mesh: createEnemyMesh(),
  position: new THREE.Vector3(0, 1.1, -13),
  speed: 5.4,
  health: 120,
  lastShotTime: 0,
  strafeDir: 1,
  strafeTimer: 0,
};
enemy.mesh.position.copy(enemy.position);
scene.add(enemy.mesh);

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
};

let lastPlayerShotTime = 0;
let gameOver = false;
let statusText = "Defeat the opponent.";
let shotsFired = 0;
let shotsLanded = 0;

const bulletCooldown = 0.28;
const enemyCooldown = 0.55;
const maxDistance = half - 2.2;

function clampToArena(vec) {
  vec.x = THREE.MathUtils.clamp(vec.x, -maxDistance, maxDistance);
  vec.z = THREE.MathUtils.clamp(vec.z, -maxDistance, maxDistance);
}

function canMoveTo(nextPos) {
  for (const col of columns) {
    const dist = nextPos.distanceTo(col.position);
    if (dist < 1.7) {
      return false;
    }
  }
  return true;
}

function updateUI() {
  playerHealthEl.textContent = String(Math.max(0, Math.ceil(player.health)));
  enemyHealthEl.textContent = String(Math.max(0, Math.ceil(enemy.health)));
  playerHealthBarEl.style.width = `${THREE.MathUtils.clamp(player.health / 90, 0, 1) * 100}%`;
  enemyHealthBarEl.style.width = `${THREE.MathUtils.clamp(enemy.health / 120, 0, 1) * 100}%`;
  enemyDistanceEl.textContent = `${player.position.distanceTo(enemy.position).toFixed(1)}m`;
  const weaponCooldown = Math.max(0, bulletCooldown - (clock.elapsedTime - lastPlayerShotTime));
  weaponStateEl.textContent = weaponCooldown > 0 ? `${weaponCooldown.toFixed(2)}s` : "Ready";
  shotsLandedEl.textContent = String(shotsLanded);
  shotsFiredEl.textContent = String(shotsFired);
  statusTextEl.textContent = statusText;
}

function shootFromPlayer(now) {
  if (now - lastPlayerShotTime < bulletCooldown || gameOver) {
    return;
  }
  lastPlayerShotTime = now;
  shotsFired += 1;

  const toEnemy = enemy.position.clone().sub(player.position);
  const distance = toEnemy.length();
  toEnemy.normalize();

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(
    new THREE.Euler(0, player.yaw, 0)
  );
  const aimDot = forward.dot(toEnemy);
  const hit = aimDot > 0.98 && distance < 35;

  if (hit) {
    shotsLanded += 1;
    enemy.health -= 25;
    setEnemyAlertColor(enemy.mesh);
    setTimeout(() => {
      resetEnemyColor(enemy.mesh);
    }, 70);
    if (enemy.health <= 0) {
      enemy.health = 0;
      gameOver = true;
      statusText = "You win! Enemy defeated.";
      restartBtn.hidden = false;
    } else {
      statusText = "Hit confirmed.";
    }
  } else {
    statusText = "Missed shot.";
  }
}

function enemyShootAtPlayer(now) {
  if (now - enemy.lastShotTime < enemyCooldown || gameOver) {
    return;
  }
  enemy.lastShotTime = now;

  const toPlayer = player.position.clone().sub(enemy.position);
  const distance = toPlayer.length();
  const hitChance = THREE.MathUtils.clamp(0.92 - distance * 0.018, 0.35, 0.88);

  if (Math.random() < hitChance) {
    player.health -= 20;
    statusText = "You were hit!";
    if (player.health <= 0) {
      player.health = 0;
      gameOver = true;
      statusText = "Game over. You were defeated.";
      restartBtn.hidden = false;
    }
  } else {
    statusText = "Enemy fired and missed.";
  }
}

function updateEnemy(dt, now) {
  if (gameOver) {
    return;
  }

  const toPlayer = player.position.clone().sub(enemy.position);
  const distance = toPlayer.length();
  const dir = toPlayer.clone().normalize();

  enemy.mesh.lookAt(player.position.x, enemy.position.y, player.position.z);

  if (distance > 7) {
    const advance = dir.multiplyScalar(enemy.speed * dt);
    const nextPos = enemy.position.clone().add(advance);
    clampToArena(nextPos);
    if (canMoveTo(nextPos)) {
      enemy.position.copy(nextPos);
    }
  } else {
    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeTimer = 0.55 + Math.random() * 0.7;
      enemy.strafeDir = Math.random() > 0.5 ? 1 : -1;
    }

    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const strafeStep = right.multiplyScalar(enemy.strafeDir * enemy.speed * 0.7 * dt);
    const nextPos = enemy.position.clone().add(strafeStep);
    clampToArena(nextPos);
    if (canMoveTo(nextPos)) {
      enemy.position.copy(nextPos);
    }

    enemyShootAtPlayer(now);
  }

  enemy.mesh.position.copy(enemy.position);
}

function updatePlayer(dt, now) {
  if (gameOver) {
    return;
  }

  const move = new THREE.Vector3();
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  if (keys.ArrowUp) {
    move.add(forward);
  }
  if (keys.ArrowDown) {
    move.sub(forward);
  }
  if (keys.ArrowLeft) {
    player.yaw += player.turnSpeed * dt;
  }
  if (keys.ArrowRight) {
    player.yaw -= player.turnSpeed * dt;
  }

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(player.speed * dt);
    const nextPos = player.position.clone().add(move);
    clampToArena(nextPos);
    if (canMoveTo(nextPos)) {
      player.position.copy(nextPos);
    }
  }

  camera.position.copy(player.position);
  camera.rotation.y = player.yaw;

  if (keys.Space) {
    shootFromPlayer(now);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const now = clock.elapsedTime;

  updatePlayer(dt, now);
  updateEnemy(dt, now);
  updateUI();

  renderer.render(scene, camera);
}

function resetGame() {
  player.position.set(0, 1.6, 16);
  player.health = 90;
  player.yaw = Math.PI;

  enemy.position.set(0, 1.1, -13);
  enemy.health = 120;
  enemy.lastShotTime = 0;
  enemy.strafeTimer = 0;
  shotsFired = 0;
  shotsLanded = 0;

  camera.position.copy(player.position);
  camera.rotation.y = player.yaw;
  enemy.mesh.position.copy(enemy.position);
  resetEnemyColor(enemy.mesh);

  gameOver = false;
  statusText = "Defeat the opponent.";
  restartBtn.hidden = true;
  updateUI();
}

window.addEventListener("keydown", (event) => {
  if (event.code in keys) {
    keys[event.code] = true;
    if (event.code === "Space") {
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

restartBtn.addEventListener("click", resetGame);

updateUI();
animate();
