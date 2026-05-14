// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title  Kard Attestor
/// @notice Aggregable on-chain record of every action a Kard agent executes.
///         Self-attestation (0-value tx with calldata) works but isn't queryable
///         by event indexers. This contract turns every attestation into an
///         indexed event so subgraphs / dune / explorers can aggregate them.
///
///         Designed for KiteAI (chainId 2366) but works on any EVM chain.
///
/// @dev    Anyone can attest. The agent address is the msg.sender. Off-chain
///         consumers should treat (agent, hash) as the unique key. Strategy
///         and goal IDs are indexed so dashboards can group by them.
contract KardAttestor {
    /// @notice Emitted on every attestation
    /// @param  agent       The Kard agent (tx signer) that performed the action
    /// @param  hash        keccak256 of the canonical envelope JSON (sorted keys)
    /// @param  strategyId  bytes32 strategy identifier (e.g. keccak256("KITE_YIELD"))
    /// @param  goalId      bytes32 goal identifier (or 0x0 if no goal active)
    /// @param  uri         optional content-addressed URI for the full envelope
    ///                     (IPFS CID, Arweave tx, https URL — your choice)
    /// @param  ts          block.timestamp
    event Attested(
        address indexed agent,
        bytes32 indexed hash,
        bytes32 indexed strategyId,
        bytes32 goalId,
        string  uri,
        uint256 ts
    );

    /// @notice Most-recent attestation hash per (agent, strategyId) pair.
    ///         Lets clients quickly check "did agent X act on strategy Y?".
    mapping(address => mapping(bytes32 => bytes32)) public lastByAgentStrategy;

    /// @notice Total attestation count per agent (for cheap "activity" queries)
    mapping(address => uint256) public countByAgent;

    /// @notice Submit a single attestation
    function attest(
        bytes32 hash,
        bytes32 strategyId,
        bytes32 goalId,
        string calldata uri
    ) external {
        require(hash != bytes32(0), "KardAttestor: zero hash");
        lastByAgentStrategy[msg.sender][strategyId] = hash;
        unchecked { countByAgent[msg.sender] += 1; }
        emit Attested(msg.sender, hash, strategyId, goalId, uri, block.timestamp);
    }

    /// @notice Batch attestation — for fleets posting many actions in one tx
    function attestBatch(
        bytes32[] calldata hashes,
        bytes32[] calldata strategyIds,
        bytes32[] calldata goalIds,
        string[]  calldata uris
    ) external {
        uint256 n = hashes.length;
        require(
            strategyIds.length == n &&
            goalIds.length    == n &&
            uris.length       == n,
            "KardAttestor: length mismatch"
        );
        for (uint256 i = 0; i < n; i++) {
            require(hashes[i] != bytes32(0), "KardAttestor: zero hash");
            lastByAgentStrategy[msg.sender][strategyIds[i]] = hashes[i];
            emit Attested(msg.sender, hashes[i], strategyIds[i], goalIds[i], uris[i], block.timestamp);
        }
        unchecked { countByAgent[msg.sender] += n; }
    }
}
