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

  const headers = {
    'Authorization': `Bearer ${voter_id}`,
  };

  fetch(`http://127.0.0.1:8000/login?voter_id=${voter_id}&password=${password}`, { headers })
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
        window.location.replace(`http://localhost:8080/admin.html?Authorization=Bearer ${data.token}`);
      } else if (data.role === 'user') {
        localStorage.setItem('jwtTokenVoter', data.token);
        window.location.replace(`http://localhost:8080/index.html?Authorization=Bearer ${data.token}`);
      }
    })
    .catch(error => {
      if (errorMsg) errorMsg.textContent = error.message;
      if (btnText)    btnText.style.display = 'inline';
      if (btnSpinner) btnSpinner.style.display = 'none';
    });
});
