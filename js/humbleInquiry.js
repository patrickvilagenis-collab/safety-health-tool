// humbleInquiry.js — reference guide shown during field visits: how to ask
// questions the "Humble Inquiry" way, plus the full question bank.
// Content from the Schindler SAO Humble Inquiry leaflet (J 46202050_00).

import { el, esc } from './utils.js';

export const HUMBLE_INQUIRY = {
  definition: 'Humble inquiry is the fine art of drawing someone out, of asking questions to which you do not know the answer, of building a relationship based on curiosity and interest in the other person.',
  author: 'Edgar H. Schein',
  principles: [
    ['Use open-ended questions', 'Prevents the employee from going into a "defensive" mode.'],
    ['Choose neutral language', 'Essential to prevent unintended bias or the perception of blame.'],
    ['Encourage insight and context', 'Help the technician explore their own thought process so you understand their "contextual rationality".'],
    ['Clarify without pressure', 'A humble conversation is a dialogue, not an interrogation. Pressure kills the flow of information.'],
    ['Focus on processes, not individuals', 'Understand how the system set the person up for failure.'],
    ['Avoid assumptions', 'Don\'t enter the conversation with a "preconceived story" of what happened.'],
  ],
  conversation: [
    ['Plan and prepare', 'Review the people, context and task. Think of 2–3 open questions to ask.'],
    ['Explain the context', 'Say clearly you\'re here to learn — not to audit, control, check or judge. Set a tone of collaboration and real curiosity.'],
    ['Appreciate the role', 'The experts are the ones doing the work; you want to learn from their experience. Acknowledge their contribution.'],
    ['Notes & permission', 'Avoid taking notes in early stages; ask permission first, explaining you want to capture insights so they aren\'t forgotten.'],
    ['Focus on the task, not the person', 'Be curious about the challenges of the task, keeping a calm conversation centered on the work.'],
    ['Be fully present', 'Listen actively, speak with intention, make eye contact. Don\'t interrupt, rush or check your phone while they talk.'],
  ],
  benefits: ['Focuses on learning', 'Does not influence the response', 'Does not establish prejudices', 'Builds a relationship'],
};

// The 4 D's (Dumb, Dangerous, Difficult, Different — a registered trademark of
// Learning Teams Inc.) and the full question bank, grouped as in the leaflet.
export const QUESTION_BANK = [
  { group: 'The 4 D\'s', questions: [
    [60, 'What part of the work could go wrong or lead to injury or harm? (Dangerous)'],
    [61, 'Which part of this task do you find takes the most effort or concentration? (Difficult)'],
    [62, 'In what ways is the task being done today different from the standard procedure or what\'s normally expected? (Different)'],
    [63, 'What in this task doesn\'t make sense or seem illogical for you? (Dumb)'],
  ] },
  { group: 'Operational learning', questions: [
    [1, 'Describe to me, what you do in this operation?'],
    [28, 'Can you explain to me the process of this task and how you learned it?'],
    [29, 'What would you say to someone who is going to perform this task for the first time?'],
    [30, 'How does the way you accomplish this task affect others?'],
    [31, 'What if everyone performed this task like this?'],
    [32, 'How would others act if no one was watching?'],
    [33, 'How would you act if there were no procedure?'],
    [34, 'If you could design your own method, what would it look like?'],
    [35, 'If you were new for this job, how could you be trained on this method?'],
    [36, 'What would make it easier for you to understand the process?'],
    [37, 'How would you describe the gap between the training you received to perform the task and how it is carried out?'],
    [38, 'How did you overcome that gap?'],
    [39, 'Which successful solutions have you come up with?'],
    [40, 'Did you share your solutions with colleagues and supervisor?'],
    [41, 'What should a good worker do? Which skills should they have?'],
    [42, 'Which mistakes could an unexperienced worker make?'],
    [43, 'Which mistakes is an experienced worker most likely to make?'],
    [44, 'What is important when performing this task? What other goals are simultaneously important? When did it last go well?'],
    [45, 'What changes have improved the position/process?'],
  ] },
  { group: 'Critical controls and protections', questions: [
    [5, 'Where is it easy to make a mistake?'],
    [6, 'What near-miss or near-miss situations have we had?'],
    [9, 'What\'s the worst that can happen during the process?'],
    [11, 'How far should we review the process to understand how it develops?'],
    [12, 'What keeps you safe when you\'re carrying out the task?'],
    [13, 'What is essential for this task to go well?'],
    [14, 'What would make you consider stopping this task? What needs to be right before you start?'],
    [15, 'What would surprise a person who does not usually perform the work?'],
    [16, 'What are the most depended-upon things that let people carry out their work?'],
  ] },
  { group: 'Tools & resources', questions: [
    [10, 'Do you have the right tools/means?'],
    [17, 'Which tools would make the job easier?'],
    [18, 'Do you have the confidence to say that you don\'t have the tools and resources to accomplish the task?'],
    [19, 'What other tools would be useful? What have you seen/done on other sites?'],
    [20, 'How can I help you find a better tool or process?'],
    [21, 'Has anyone explained what tools and resources are available? Was it enough?'],
    [22, 'Are those the appropriate kind of tools? How accessible are they?'],
    [23, 'Have you ever had to adapt your tools to fit the job?'],
    [24, 'What do you do if you don\'t have the tool you need?'],
    [25, 'Do you feel comfortable using this tool?'],
    [26, 'Can this tool be difficult to use?'],
    [27, 'What tools or resources do you like to use?'],
  ] },
  { group: 'Conditions and restrictions', questions: [
    [2, 'How difficult is it to carry out this task?'],
    [3, 'Under what circumstances is the process good?'],
    [4, 'Under what circumstances do difficulties arise in the process?'],
    [7, 'What is very predictable in the task/process?'],
    [8, 'What is very unpredictable in the task/process?'],
    [46, 'Have you been set up for success?'],
    [47, 'Is there anything in your environment that we could change that would help?'],
    [48, 'If you had €50,000 (for example), how would you invest it to improve the job?'],
    [49, 'What are the worst possible conditions for performing this task? When has this happened?'],
    [50, 'What frustrates you about this job?'],
    [51, 'What made you enjoy coming to work this week?'],
    [52, 'What makes your job easier? What makes it difficult? Tell me about a difficult situation.'],
    [53, 'What makes different environments unique? What works well / doesn\'t work?'],
    [54, 'Where are the bottlenecks?'],
    [55, 'Where will the next incident occur?'],
    [56, 'What disrupts people and processes?'],
    [57, 'What do people around here have to "tolerate"? What have you done to make it easier?'],
    [58, 'When and where do you need to be more alert?'],
    [59, 'How has the work environment changed here and how has it impacted your work?'],
  ] },
];

export function openHumbleInquiry() {
  document.getElementById('hiModal')?.remove();
  const hi = HUMBLE_INQUIRY;
  const total = QUESTION_BANK.reduce((n, g) => n + g.questions.length, 0);
  const modal = el('div', { id: 'hiModal', class: 'hi-modal', onClick: (e) => { if (e.target.id === 'hiModal') modal.remove(); } });
  modal.innerHTML = `
    <div class="hi-panel">
      <div class="hi-head">
        <h2>💬 Humble Inquiry — how to ask</h2>
        <button class="icon-btn" id="hiClose" title="Close" aria-label="Close">✕</button>
      </div>
      <div class="hi-body">
        <blockquote class="hi-quote">“${esc(hi.definition)}”<cite>— ${esc(hi.author)}</cite></blockquote>

        <h3>Questioning principles</h3>
        <ul class="hi-list">${hi.principles.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')}</ul>

        <h3>The conversation</h3>
        <ul class="hi-list">${hi.conversation.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')}</ul>

        <h3>Why it works</h3>
        <div class="hi-benefits">${hi.benefits.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>

        <h3>Question bank · ${total} prompts</h3>
        <p class="hint">Open-ended prompts to draw out how the work is really done. Tap a group to expand.</p>
        ${QUESTION_BANK.map((g, i) => `
          <details class="hi-qgroup" ${i === 0 ? 'open' : ''}>
            <summary>${esc(g.group)} <span class="hi-qn">${g.questions.length}</span></summary>
            <ul class="hi-qlist">${g.questions.map(([n, q]) => `<li><b>${n}.</b> ${esc(q)}</li>`).join('')}</ul>
          </details>`).join('')}
        <p class="hi-src">4 D's — Dumb, Dangerous, Difficult, Different is a registered trademark of Learning Teams Inc.</p>
      </div>
    </div>`;
  document.body.append(modal);
  modal.querySelector('#hiClose').addEventListener('click', () => modal.remove());
  requestAnimationFrame(() => modal.classList.add('open'));
}
