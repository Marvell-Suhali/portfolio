import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');

const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');

renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('Marvell-Suhali');

const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  profileStats.innerHTML = `
    <div class="github-grid">
      <div>
        <p>Repos</p>
        <h3>${githubData.public_repos}</h3>
      </div>

      <div>
        <p>Followers</p>
        <h3>${githubData.followers}</h3>
      </div>

      <div>
        <p>Following</p>
        <h3>${githubData.following}</h3>
      </div>
    </div>
  `;
}