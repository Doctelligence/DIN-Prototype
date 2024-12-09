// src/DINManager.tsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import DINManagerABI from './DINManagerABI.json'; // Import the ABI of the DINManager contract

declare global {
  interface Window {
    ethereum: any;
  }
}

const DINManager: React.FC = () => {
  const [provider, setProvider] = useState<ethers.Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [projectCount, setProjectCount] = useState<number>(0);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        // 
        // setProjectCount(projectCount.toNumber());
      } else {
        console.error("Ethereum object doesn't exist!");
      }
    };

    init();
  }, []);

  const createProject = async () => {
    if (contract) {
      const tx = await contract.createProject();
      await tx.wait();
      const projectCount = await contract.projectCount();
      setProjectCount(projectCount.toNumber());
    }
  };

  return (
    <div>
      <h1>DIN Manager</h1>
      <p>Project Count: {projectCount}</p>
      <button onClick={createProject}>Create Project</button>
    </div>
  );
};

export default DINManager;
