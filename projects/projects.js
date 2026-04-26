import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const container = document.querySelector('.projects');

renderProjects(projects, container, 'h2');

const title = document.querySelector('.projects-title');

if (title) {
  title.textContent = `${projects.length} Projects`;
}