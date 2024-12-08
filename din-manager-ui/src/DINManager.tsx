// src/DINManager.tsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import DINManagerABI from './DINManagerABI.json'; // Import the ABI of the DINManager contract

const DINManager: React.FC = () => {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [projectCount, setProjectCount] = useState<number>(0);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contractAddress = 'YOUR_CONTRACT_ADDRESS'; // Replace with your deployed contract address
        const contract = new ethers.Contract(contractAddress, DINManagerABI, signer);

        setProvider(provider);
        setSigner(signer);
        setContract(contract);

        const projectCount = await contract.projectCount();
        setProjectCount(projectCount.toNumber());
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
