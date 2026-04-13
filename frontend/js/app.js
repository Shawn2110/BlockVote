const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../blockchain/build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts);

window.App = {
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
    $("#accountAddress").text(short);

    var instance;
    try {
      // Try deployed() first (uses network ID lookup)
      instance = await VotingContract.deployed();
    } catch (err) {
      // Fallback: use the address directly from artifacts
      var networks = votingArtifacts.networks;
      var networkKeys = Object.keys(networks);
      if (networkKeys.length === 0) {
        $('#boxCandidate').html('<div class="empty-state" style="color:#f85149">No deployed contract found. Run truffle migrate and rebuild the bundle.</div>');
        $("#dates").text("Contract not deployed");
        return;
      }
      // Use the most recently deployed address
      var latestAddress = networks[networkKeys[networkKeys.length - 1]].address;
      try {
        instance = await VotingContract.at(latestAddress);
      } catch (err2) {
        $('#boxCandidate').html('<div class="empty-state" style="color:#f85149">Could not connect to contract at ' + latestAddress + '. Make sure MetaMask is on Localhost 8545 and refresh.</div>');
        $("#dates").text("Network error — check MetaMask");
        return;
      }
    }

    // --- Voting dates ---
    instance.getDates().then(function (result) {
      var start = new Date(result[0] * 1000);
      var end   = new Date(result[1] * 1000);
      if (result[0] * 1 === 0) {
        $("#dates").text("Voting period not set yet");
      } else {
        $("#dates").text(
          start.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) +
          " — " +
          end.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
        );
      }
    }).catch(function (err) { console.error("getDates error:", err.message); });

    // --- Admin controls ---
    $(document).ready(function () {
      $('#addCandidate').click(function () {
        var nameCandidate  = $('#name').val().trim();
        var partyCandidate = $('#party').val().trim();
        if (!nameCandidate || !partyCandidate) {
          $('#candidateMsg').text('Please fill in both fields.').addClass('error');
          return;
        }
        $(this).prop('disabled', true).text('Adding...');
        instance.addCandidate(nameCandidate, partyCandidate).then(function () {
          $('#candidateMsg').text('Candidate added successfully!').removeClass('error');
          $('#name').val('');
          $('#party').val('');
          $('#addCandidate').prop('disabled', false).html(
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Candidate'
          );
          App.loadCandidates(instance);
        }).catch(function (err) {
          $('#candidateMsg').text('Error: ' + err.message).addClass('error');
          $('#addCandidate').prop('disabled', false);
        });
      });

      $('#addDate').click(function () {
        var startDate = Date.parse(document.getElementById("startDate").value) / 1000;
        var endDate   = Date.parse(document.getElementById("endDate").value) / 1000;
        if (!startDate || !endDate) {
          $('#dateMsg').text('Please select both dates.').addClass('error');
          return;
        }
        $(this).prop('disabled', true).text('Setting...');
        instance.setDates(startDate, endDate).then(function () {
          $('#dateMsg').text('Voting dates set successfully!').removeClass('error');
          $('#addDate').prop('disabled', false).html(
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Set Voting Dates'
          );
        }).catch(function (err) {
          $('#dateMsg').text('Error: ' + err.message).addClass('error');
          $('#addDate').prop('disabled', false);
        });
      });
    });

    // --- Load candidates ---
    App.loadCandidates(instance);

    // --- Check if already voted (voter page only) ---
    instance.checkVote().then(function (voted) {
      if (!voted) {
        $("#voteButton").attr("disabled", false);
      } else {
        $("#voteButton").attr("disabled", true);
        $("#msg").text("You have already cast your vote. Thank you!").css('color', '#3fb950');
      }
    });
  },

  loadCandidates: function (instance) {
    instance.getCountCandidates().then(function (countCandidates) {
      var count = parseInt(countCandidates);

      $('#candidateCount').text(count + ' candidate' + (count !== 1 ? 's' : ''));

      if (count === 0) {
        $('#boxCandidate').html('<div class="empty-state">No candidates registered yet.</div>');
        return;
      }

      var promises = [];
      for (var i = 1; i <= count; i++) {
        promises.push(instance.getCandidate(i));
      }

      Promise.all(promises).then(function (candidates) {
        var totalVotes = candidates.reduce(function (sum, c) {
          return sum + parseInt(c[3]);
        }, 0);

        $('#boxCandidate').empty();

        var isAdminPage = document.title.includes('Admin');

        candidates.forEach(function (data) {
          var id        = data[0];
          var name      = data[1];
          var party     = data[2];
          var voteCount = parseInt(data[3]);
          var percent   = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
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
                <div class="vote-bar-label">
                  <span class="vote-count-text">${voteCount} vote${voteCount !== 1 ? 's' : ''}</span>
                  <span class="vote-percent-text">${percent}%</span>
                </div>
                <div class="vote-bar-track">
                  <div class="vote-bar-fill" style="width: 0%;" data-width="${percent}%"></div>
                </div>
              </div>`;
            $('#boxCandidate').append(card);
          }
        });

        setTimeout(function () {
          $('.vote-bar-fill').each(function () {
            $(this).css('width', $(this).data('width'));
          });
        }, 100);

      }).catch(function (err) {
        console.error("loadCandidates error:", err.message);
      });
    });
  },

  selectCandidate: function (el, id) {
    $('.candidate-card').removeClass('selected');
    $('input[name="candidate"]').prop('checked', false);
    $(el).addClass('selected');
    $('#c' + id).prop('checked', true);
  },

  vote: function () {
    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $("#msg").text("Please select a candidate before voting.").css('color', '#f85149');
      return;
    }
    $("#voteButton").attr("disabled", true).text("Submitting...");
    $("#msg").text("Waiting for blockchain confirmation...").css('color', '#8b949e');

    VotingContract.deployed().then(function (instance) {
      instance.vote(parseInt(candidateID)).then(function () {
        $("#msg").text("Vote cast successfully! Thank you for participating.").css('color', '#3fb950');
        setTimeout(function () { window.location.reload(); }, 2000);
      });
    }).catch(function (err) {
      console.error("vote error:", err.message);
      $("#msg").text("Error: " + err.message).css('color', '#f85149');
      $("#voteButton").attr("disabled", false).text("Cast Vote on Blockchain");
    });
  }
};

window.addEventListener("load", function () {
  if (typeof window.ethereum !== "undefined") {
    window.eth = new Web3(window.ethereum);
  } else {
    console.warn("No MetaMask detected. Falling back to http://127.0.0.1:7545");
    window.eth = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }
  window.App.eventStart();
});
