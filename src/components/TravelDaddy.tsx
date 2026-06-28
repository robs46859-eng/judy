"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

// A placeholder 3D component since we don't have the generated Avatar GLB yet.
function PlaceholderLumberjack(props: any) {
  const group = useRef<THREE.Group>(null);
  
  // Simple idle animation logic
  useFrame((state) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05 - 1;
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={group} {...props} dispose={null}>
      {/* Torso */}
      <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
        <boxGeometry args={[0.8, 1, 0.4]} />
        <meshStandardMaterial color="#b22222" /> {/* Flannel red */}
      </mesh>
      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color="#fcd9b8" /> {/* Skin tone */}
      </mesh>
      {/* Beanie */}
      <mesh castShadow receiveShadow position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.2, 32]} />
        <meshStandardMaterial color="#228b22" /> {/* Hunter green */}
      </mesh>
      {/* Legs */}
      <mesh castShadow receiveShadow position={[-0.2, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 32]} />
        <meshStandardMaterial color="#000080" /> {/* Blue jeans */}
      </mesh>
      <mesh castShadow receiveShadow position={[0.2, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 32]} />
        <meshStandardMaterial color="#000080" />
      </mesh>
    </group>
  );
}

export default function TravelDaddy() {
  return (
    <div className="canvas-wrapper">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <PlaceholderLumberjack />
        <Environment preset="city" />
        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={10} blur={2} far={4} />
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  );
}
