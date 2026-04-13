const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const voter_id = document.getElementById('voter-id').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-msg');
  const btnText  = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  if (!voter_id || !password) {
    errorMsg.textContent = 'Please enter your Voter ID and password.';
    return;
  }

  // Show spinner
  if (btnText)    btnText.style.display = 'none';
  if (btnSpinner) btnSpinner.style.display = 'inline-block';
  if (errorMsg)   errorMsg.textContent = '';

  fetch(`/login?voter_id=${encodeURIComponent(voter_id)}&password=${encodeURIComponent(password)}`)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Invalid Voter ID or password.');
      }
    })
    .then(data => {
      if (data.role === 'admin') {
        localStorage.setItem('jwtTokenAdmin', data.token);
        window.location.replace(`/admin.html?Authorization=Bearer ${data.token}`);
      } else if (data.role === 'user') {
        localStorage.setItem('jwtTokenVoter', data.token);
        window.location.replace(`/index.html?Authorization=Bearer ${data.token}`);
      }
    })
    .catch(error => {
      if (errorMsg) errorMsg.textContent = error.message;
      if (btnText)    btnText.style.display = 'inline';
      if (btnSpinner) btnSpinner.style.display = 'none';
    });
});
