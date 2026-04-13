
pragma solidity ^0.5.15;

contract Voting {

    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Election {
        uint id;
        string name;
        uint256 startDate;
        uint256 endDate;
        uint countCandidates;
    }

    uint public countElections;

    mapping(uint => Election) public elections;
    mapping(uint => mapping(uint => Candidate)) public candidates;
    mapping(uint => mapping(address => bool)) public voters;

    // ── Election management ─────────────────────────────────────────────────

    function createElection(string memory _name) public returns (uint) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        countElections++;
        elections[countElections] = Election(countElections, _name, 0, 0, 0);
        return countElections;
    }

    function getCountElections() public view returns (uint) {
        return countElections;
    }

    function getElection(uint _electionId) public view returns (
        uint, string memory, uint256, uint256, uint
    ) {
        Election storage e = elections[_electionId];
        return (e.id, e.name, e.startDate, e.endDate, e.countCandidates);
    }

    // ── Voting period ───────────────────────────────────────────────────────

    function setDates(uint _electionId, uint256 _start, uint256 _end) public {
        require(_electionId > 0 && _electionId <= countElections, "Invalid election");
        require(_end > _start, "End must be after start");
        elections[_electionId].startDate = _start;
        elections[_electionId].endDate   = _end;
    }

    function getDates(uint _electionId) public view returns (uint256, uint256) {
        return (elections[_electionId].startDate, elections[_electionId].endDate);
    }

    // ── Candidate management ────────────────────────────────────────────────

    function addCandidate(uint _electionId, string memory _name, string memory _party) public returns (uint) {
        require(_electionId > 0 && _electionId <= countElections, "Invalid election");
        elections[_electionId].countCandidates++;
        uint newId = elections[_electionId].countCandidates;
        candidates[_electionId][newId] = Candidate(newId, _name, _party, 0);
        return newId;
    }

    function getCountCandidates(uint _electionId) public view returns (uint) {
        return elections[_electionId].countCandidates;
    }

    function getCandidate(uint _electionId, uint _candidateId) public view returns (
        uint, string memory, string memory, uint
    ) {
        Candidate storage c = candidates[_electionId][_candidateId];
        return (c.id, c.name, c.party, c.voteCount);
    }

    // ── Voting ──────────────────────────────────────────────────────────────

    function vote(uint _electionId, uint _candidateId) public {
        Election storage e = elections[_electionId];
        require(_electionId > 0 && _electionId <= countElections, "Invalid election");
        require(e.startDate > 0, "Voting period not set");
        require(now >= e.startDate && now < e.endDate, "Not within voting period");
        require(_candidateId > 0 && _candidateId <= e.countCandidates, "Invalid candidate");
        require(!voters[_electionId][msg.sender], "Already voted in this election");
        voters[_electionId][msg.sender] = true;
        candidates[_electionId][_candidateId].voteCount++;
    }

    function checkVote(uint _electionId) public view returns (bool) {
        return voters[_electionId][msg.sender];
    }
}
