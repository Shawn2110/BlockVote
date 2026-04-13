const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../blockchain/build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts);

window.App = {
  instance: null,
  selectedElectionId: null,

  eventStart: async function () {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask not detected. Please install MetaMask and refresh.');
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } catch (err) {
      alert('MetaMask connection rejected. Please approve the connection and refresh.');
      return;
    }

    VotingContract.setProvider(window.ethereum);
    VotingContract.defaults({ from: window.ethereum.selectedAddress, gas: 6654755 });

    App.account = window.ethereum.selectedAddress;

    var addr = window.ethereum.selectedAddress;
    var short = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
    $('#accountAddress').text(short);

    try {
      App.instance = await VotingContract.deployed();
    } catch (err) {
      var networks = votingArtifacts.networks;
      var networkKeys = Object.keys(networks);
      if (networkKeys.length === 0) {
        var errHtml = '<div class="empty-state" style="color:#f85149">No deployed contract found. Run truffle migrate and rebuild the bundle.</div>';
        if ($('#electionTabsWrapper').length) $('#electionTabsWrapper').html(errHtml);
        if ($('#electionTabs').length) $('#electionTabs').html(errHtml);
        return;
      }
      var latestAddress = networks[networkKeys[networkKeys.length - 1]].address;
      try {
        App.instance = await VotingContract.at(latestAddress);
      } catch (err2) {
        var netErrHtml = '<div class="empty-state" style="color:#f85149">Could not connect to contract at ' + latestAddress + '. Make sure MetaMask is on Localhost 8545 and refresh.</div>';
        if ($('#electionTabsWrapper').length) $('#electionTabsWrapper').html(netErrHtml);
        if ($('#electionTabs').length) $('#electionTabs').html(netErrHtml);
        return;
      }
    }

    var isAdminPage = document.title.includes('Admin');

    if (isAdminPage) {
      App.initAdmin();
    } else {
      App.initVoter();
    }
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  initAdmin: function () {
    App.loadElectionTabs('admin');

    $(document).ready(function () {

      $('#createElectionBtn').click(function () {
        var name = $('#electionNameInput').val().trim();
        if (!name) {
          $('#electionMsg').text('Please enter an election name.').css('color', '#f85149');
          return;
        }
        $(this).prop('disabled', true).text('Creating...');
        App.instance.createElection(name).then(function () {
          $('#electionMsg').text('Election created successfully!').css('color', '#3fb950');
          $('#electionNameInput').val('');
          $('#createElectionBtn').prop('disabled', false).html(
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Election'
          );
          App.loadElectionTabs('admin');
        }).catch(function (err) {
          $('#electionMsg').text('Error: ' + err.message).css('color', '#f85149');
          $('#createElectionBtn').prop('disabled', false);
        });
      });

      $('#addCandidate').click(function () {
        if (!App.selectedElectionId) {
          $('#candidateMsg').text('Select an election first.').css('color', '#f85149');
          return;
        }
        var nameVal  = $('#name').val().trim();
        var partyVal = $('#party').val().trim();
        if (!nameVal || !partyVal) {
          $('#candidateMsg').text('Please fill in both fields.').css('color', '#f85149');
          return;
        }
        $(this).prop('disabled', true).text('Adding...');
        App.instance.addCandidate(App.selectedElectionId, nameVal, partyVal).then(function () {
          $('#candidateMsg').text('Candidate added successfully!').css('color', '#3fb950');
          $('#name').val('');
          $('#party').val('');
          $('#addCandidate').prop('disabled', false).html(
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Candidate'
          );
          App.loadCandidates(App.instance, App.selectedElectionId);
        }).catch(function (err) {
          $('#candidateMsg').text('Error: ' + err.message).css('color', '#f85149');
          $('#addCandidate').prop('disabled', false);
        });
      });

      $('#addDate').click(function () {
        if (!App.selectedElectionId) {
          $('#dateMsg').text('Select an election first.').css('color', '#f85149');
          return;
        }
        var startDate = Date.parse(document.getElementById('startDate').value) / 1000;
        var endDate   = Date.parse(document.getElementById('endDate').value) / 1000;
        if (!startDate || !endDate) {
          $('#dateMsg').text('Please select both dates.').css('color', '#f85149');
          return;
        }
        $(this).prop('disabled', true).text('Setting...');
        App.instance.setDates(App.selectedElectionId, startDate, endDate).then(function () {
          $('#dateMsg').text('Voting dates set successfully!').css('color', '#3fb950');
          $('#addDate').prop('disabled', false).html(
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Set Voting Dates'
          );
        }).catch(function (err) {
          $('#dateMsg').text('Error: ' + err.message).css('color', '#f85149');
          $('#addDate').prop('disabled', false);
        });
      });
    });
  },

  // ── Voter ─────────────────────────────────────────────────────────────────

  initVoter: function () {
    App.loadElectionTabs('voter');
  },

  // ── Elections ─────────────────────────────────────────────────────────────

  loadElectionTabs: function (mode) {
    App.instance.getCountElections().then(function (countRaw) {
      var count = parseInt(countRaw);

      if (mode === 'admin') {
        $('#electionCount').text(count + ' election' + (count !== 1 ? 's' : ''));
      }

      if (count === 0) {
        var emptyMsg = mode === 'admin'
          ? '<div class="empty-state">No elections yet. Create one above.</div>'
          : '<div class="empty-state">No elections have been created yet. Check back later.</div>';
        if (mode === 'admin') $('#electionTabs').html(emptyMsg);
        else $('#electionTabsWrapper').html(emptyMsg);
        return;
      }

      var promises = [];
      for (var i = 1; i <= count; i++) {
        promises.push(App.instance.getElection(i));
      }

      Promise.all(promises).then(function (elections) {
        var tabsHtml = '<div class="election-tabs">';
        elections.forEach(function (e) {
          var id   = parseInt(e[0]);
          var name = e[1];
          tabsHtml += '<button class="election-tab" data-id="' + id + '" onclick="App.selectElection(' + id + ', \'' + mode + '\')">' + name + '</button>';
        });
        tabsHtml += '</div>';

        if (mode === 'admin') {
          $('#electionTabs').html(tabsHtml);
        } else {
          $('#electionTabsWrapper').html(tabsHtml);
        }

        // Auto-select the first election
        if (elections.length > 0) {
          App.selectElection(parseInt(elections[0][0]), mode);
        }
      }).catch(function (err) {
        console.error('loadElectionTabs error:', err.message);
      });
    });
  },

  selectElection: function (electionId, mode) {
    App.selectedElectionId = electionId;

    // Highlight active tab
    $('.election-tab').removeClass('active');
    $('.election-tab[data-id="' + electionId + '"]').addClass('active');

    App.instance.getElection(electionId).then(function (e) {
      var name      = e[1];
      var startTs   = parseInt(e[2]);
      var endTs     = parseInt(e[3]);

      if (mode === 'admin') {
        $('#managingElectionName').text(name);
        $('#electionManagement').show();
        App.loadCandidates(App.instance, electionId);
      } else {
        $('#electionTitle').text(name);

        if (startTs === 0) {
          $('#dates').text('Voting period not set yet');
        } else {
          var start = new Date(startTs * 1000);
          var end   = new Date(endTs * 1000);
          $('#dates').text(
            start.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' — ' +
            end.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          );
        }

        $('#electionView').show();
        $('#msg').text('').css('color', '');
        $('#voteButton').attr('disabled', true);

        App.loadCandidates(App.instance, electionId);

        // Check if voter already voted in this election
        App.instance.checkVote(electionId).then(function (voted) {
          if (voted) {
            $('#voteButton').attr('disabled', true);
            $('#msg').text('You have already cast your vote in this election. Thank you!').css('color', '#3fb950');
          } else {
            // Enable only after a candidate is selected
            $('#voteButton').attr('disabled', true);
          }
        });
      }
    }).catch(function (err) {
      console.error('selectElection error:', err.message);
    });
  },

  // ── Candidates ────────────────────────────────────────────────────────────

  loadCandidates: function (instance, electionId) {
    instance.getCountCandidates(electionId).then(function (countRaw) {
      var count = parseInt(countRaw);

      $('#candidateCount').text(count + ' candidate' + (count !== 1 ? 's' : ''));

      if (count === 0) {
        $('#boxCandidate').html('<div class="empty-state">No candidates registered yet.</div>');
        return;
      }

      var promises = [];
      for (var i = 1; i <= count; i++) {
        promises.push(instance.getCandidate(electionId, i));
      }

      Promise.all(promises).then(function (candidates) {
        $('#boxCandidate').empty();

        var isAdminPage = document.title.includes('Admin');

        candidates.forEach(function (data) {
          var id        = data[0];
          var name      = data[1];
          var party     = data[2];
          var voteCount = parseInt(data[3]);
          var initial   = name.charAt(0).toUpperCase();

          if (isAdminPage) {
            var row = `
              <div class="admin-candidate-row">
                <div class="row-avatar">${initial}</div>
                <div class="row-info">
                  <div class="row-name">${name}</div>
                  <span class="row-party">${party}</span>
                </div>
                <div class="row-votes">
                  <div class="row-vote-count">${voteCount}</div>
                  <div class="row-vote-label">votes</div>
                </div>
              </div>`;
            $('#boxCandidate').append(row);
          } else {
            var card = `
              <div class="candidate-card" data-id="${id}" onclick="App.selectCandidate(this, ${id})">
                <input type="radio" name="candidate" value="${id}" id="c${id}">
                <div class="card-top">
                  <div class="candidate-avatar">${initial}</div>
                  <div class="candidate-info">
                    <div class="candidate-name">${name}</div>
                    <span class="candidate-party">${party}</span>
                  </div>
                  <div class="select-indicator">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
              </div>`;
            $('#boxCandidate').append(card);
          }
        });

      }).catch(function (err) {
        console.error('loadCandidates error:', err.message);
      });
    });
  },

  selectCandidate: function (el, id) {
    // Don't allow selection if already voted
    if ($('#voteButton').attr('disabled') && $('#msg').css('color') === 'rgb(63, 185, 80)') return;
    $('.candidate-card').removeClass('selected');
    $('input[name="candidate"]').prop('checked', false);
    $(el).addClass('selected');
    $('#c' + id).prop('checked', true);
    $('#voteButton').attr('disabled', false);
  },

  vote: function () {
    if (!App.selectedElectionId) {
      $('#msg').text('Please select an election first.').css('color', '#f85149');
      return;
    }
    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $('#msg').text('Please select a candidate before voting.').css('color', '#f85149');
      return;
    }
    $('#voteButton').attr('disabled', true).text('Submitting...');
    $('#msg').text('Waiting for blockchain confirmation...').css('color', '#8b949e');

    App.instance.vote(App.selectedElectionId, parseInt(candidateID)).then(function () {
      $('#msg').text('Vote cast successfully! Thank you for participating.').css('color', '#3fb950');
      setTimeout(function () { window.location.reload(); }, 2000);
    }).catch(function (err) {
      console.error('vote error:', err.message);
      $('#msg').text('Error: ' + err.message).css('color', '#f85149');
      $('#voteButton').attr('disabled', false).html(
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Cast Vote on Blockchain'
      );
    });
  }
};

window.addEventListener('load', function () {
  if (typeof window.ethereum !== 'undefined') {
    window.eth = new Web3(window.ethereum);
  } else {
    console.warn('No MetaMask detected. Falling back to http://127.0.0.1:8545');
    window.eth = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
  }
  window.App.eventStart();
});
