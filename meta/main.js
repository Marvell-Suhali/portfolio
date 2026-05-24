import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let data = [];
let commits = [];
let filteredCommits = [];

let xScale;
let yScale;
let timeScale;

const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: `https://github.com/Marvell-Suhali/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total LOC');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Total files');
  dl.append('dd').text(d3.group(data, (d) => d.file).size);

  dl.append('dt').text('Average line length');
  dl.append('dd').text(d3.mean(data, (d) => d.length).toFixed(1));

  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(d3.max(data, (d) => d.depth));
}

function renderTooltipContent(commit) {
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id.slice(0, 7);

  document.getElementById('commit-date').textContent =
    commit.datetime.toLocaleDateString();

  document.getElementById('commit-time-tooltip').textContent =
    commit.datetime.toLocaleTimeString();

  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');

  tooltip.hidden = !isVisible;

  tooltip.style.position = 'fixed';
  tooltip.style.left = '20px';
  tooltip.style.top = '20px';
  tooltip.style.background = 'white';
  tooltip.style.color = 'black';
  tooltip.style.border = '1px solid #ccc';
  tooltip.style.borderRadius = '0.5rem';
  tooltip.style.padding = '0.75rem';
  tooltip.style.boxShadow = '0 4px 12px rgb(0 0 0 / 20%)';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '9999';
  tooltip.style.maxWidth = '250px';
}

function updateTooltipPosition() {
  const tooltip = document.getElementById('commit-tooltip');

  tooltip.style.left = '20px';
  tooltip.style.top = '20px';
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;

  const margin = { top: 10, right: 10, bottom: 40, left: 50 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat('')
        .tickSize(-usableArea.width),
    );

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );

  svg
    .append('g')
    .attr('class', 'brush')
    .call(d3.brush().on('start brush end', brushed));

  svg.append('g').attr('class', 'dots');

  updateScatterPlot(commits);
}

function updateScatterPlot(commitsToShow) {
  filteredCommits = commitsToShow;

  const svg = d3.select('#chart').select('svg');

  if (commitsToShow.length === 0) {
    svg.select('.dots').selectAll('circle').remove();
    return;
  }

  xScale.domain(d3.extent(commitsToShow, (d) => d.datetime)).nice();

  const [minLines, maxLines] = d3.extent(commitsToShow, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([3, 30]);

  svg.select('.x-axis').call(d3.axisBottom(xScale));

  const sortedCommits = d3.sort(commitsToShow, (d) => -d.totalLines);

  svg
    .select('.dots')
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition();
    })
    .on('mousemove', () => {
      updateTooltipPosition();
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  svg.select('.dots').raise();
}

function updateFileDisplay(commitsToShow) {
  const lines = commitsToShow.flatMap((d) => d.lines);

  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div.file-row')
    .data(files, (d) => d.name)
    .join((enter) => {
      const div = enter.append('div').attr('class', 'file-row');
      div.append('dt');
      div.append('dd');
      return div;
    });

  filesContainer
    .select('dt')
    .html((d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  filesContainer
    .select('dd')
    .selectAll('span.loc')
    .data((d) => d.lines)
    .join('span')
    .attr('class', 'loc')
    .style('--color', (d) => colors(d.type));
}

function updateTimeDisplay(commitMaxTime) {
  d3.select('#commit-time').text(
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  );
}

function onTimeSliderChange() {
  const commitProgress = Number(d3.select('#commit-progress').property('value'));
  const commitMaxTime = timeScale.invert(commitProgress);

  updateTimeDisplay(commitMaxTime);

  const commitsToShow = commits.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(commitsToShow);
  updateFileDisplay(commitsToShow);
}

function renderStory() {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })},
          I made <a href="${d.url}" target="_blank">${
            i > 0 ? 'another commit' : 'my first commit'
          }</a>.
        </p>
        <p>
          This commit edited ${d.totalLines} lines.
        </p>
      `,
    );

  const scroller = scrollama();

  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter((response) => {
      const commit = response.element.__data__;
      const commitMaxTime = commit.datetime;

      const commitsToShow = commits.filter((d) => d.datetime <= commitMaxTime);

      updateScatterPlot(commitsToShow);

      // Keep the bottom file visualization complete while scrolling
      updateFileDisplay(commits);

      updateTimeDisplay(commitMaxTime);

      d3.select('#commit-progress').property('value', timeScale(commitMaxTime));
    });

  window.addEventListener('resize', scroller.resize);
}

data = await loadData();
commits = processCommits(data);
filteredCommits = commits;

timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);

renderCommitInfo(data, commits);
renderScatterPlot(commits);
updateFileDisplay(commits);
updateTimeDisplay(d3.max(commits, (d) => d.datetime));
renderStory();

d3.select('#commit-progress').on('input', onTimeSliderChange);