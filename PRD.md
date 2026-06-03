# AI Notebook PRD

## 1. Product Positioning

### Product Name

Working name: AI Notebook

### One-line Description

An AI-powered personal notebook for capturing work todos, saving inspiration from social platforms and AI chats, and generating daily or weekly work summaries.

### Core Value

The product solves four main problems:

1. Work tasks are scattered across memory, chat tools, and documents.
2. Inspiration from Xiaohongshu, AI chats, WeChat, and Feishu is easy to lose.
3. Notes and todos are often separated, so ideas do not become actions.
4. Daily reports, weekly reports, and reviews require too much manual recall and organization.

## 2. Target Users

### MVP Stage

The first version is for personal use.

Primary user profile:

- Needs to manage daily work tasks.
- Frequently captures ideas from AI chats.
- Collects inspiration from Xiaohongshu, WeChat, Feishu, and other platforms.
- Needs to generate daily reports, weekly reports, reviews, and work summaries.

### Future Stage

The product can later expand to:

- Content creators.
- Product managers, operators, marketers, consultants, and knowledge workers.
- Small team collaboration.
- Personal knowledge management users.

## 3. Product Goals

### MVP Goals

The MVP should complete the following workflow:

1. Quickly create notes.
2. Create and manage simple todos.
3. Associate todos with notes.
4. Manually save copied content from Xiaohongshu, AI chats, WeChat, and Feishu.
5. Use AI to summarize, classify, tag, and extract todos.
6. Generate daily reports and weekly reports from notes, todos, and saved clips.
7. Search historical notes and saved content.

### Non-MVP Goals

Later versions can add:

- Browser extension clipping.
- Mobile share-menu capture.
- WeChat and Feishu integration.
- OCR screenshot capture.
- Multi-device sync.
- Team collaboration.
- User accounts and public launch support.

## 4. Core Modules

## 4.1 Notebook Module

### Description

Users can organize notes in notebooks, similar to Evernote.

### MVP Features

- Create notebooks.
- Create notes.
- Edit note title and content.
- Support Markdown or lightweight rich text editing.
- Support basic formatting:
  - Headings.
  - Bold text.
  - Lists.
  - Quotes.
  - Links.
  - Code blocks.
- Auto-save notes.
- Record created and updated time.
- Assign each note to a notebook.

### Recommended Default Notebooks

- Work Notes.
- Inspiration Inbox.
- AI Chat Clips.
- Xiaohongshu Inspiration.
- Daily and Weekly Reports.
- Unsorted Inbox.

## 4.2 Todo Module

### Description

The todo module should stay simple, but it must be connected to notes.

### MVP Features

- Create todos.
- Mark todos as complete or incomplete.
- Set due date.
- Set priority:
  - High.
  - Medium.
  - Low.
- Associate todos with notes.
- Insert todos directly inside note content.
- Sync todos from note content to the todo list.
- Filter todo list by:
  - Today.
  - Incomplete.
  - Completed.
  - Overdue.
  - From notes.

### Key Interaction

When the user writes the following inside a note:

```markdown
- [ ] Prepare the project proposal tomorrow
```

The system should recognize it as a todo and add it to the todo list.

AI can also extract todos from natural language notes.

Example input:

```text
This week I need to complete competitor research, organize user feedback, and write the product proposal.
```

Example output:

```text
1. Complete competitor research.
2. Organize user feedback.
3. Write the product proposal.
```

## 4.3 Clip Inbox Module

### Description

The clip inbox collects unorganized inspiration and copied content from external platforms.

### MVP Supported Sources

- Manual input.
- Manual copy and paste.
- AI chat content.
- Xiaohongshu content.
- WeChat messages.
- Feishu messages.

### Clip Fields

Each clip should support:

- Original content.
- Source platform.
- Optional source URL.
- Created time.
- AI summary.
- AI tags.
- Recommended notebook.
- Whether it should become a todo.
- Whether it should be included in daily or weekly reports.

### Source Options

- Xiaohongshu.
- AI Chat.
- WeChat.
- Feishu.
- Web Page.
- Manual Input.
- Other.

### MVP Interaction

After pasting content, the user can choose:

- Save original content.
- AI summarize.
- AI extract todos.
- AI classify into a notebook.
- AI generate tags.
- Convert to formal note.

## 4.4 AI Organization Module

### Description

AI is a core part of the product. It should reduce manual organization work and make notes actionable.

### MVP AI Features

#### 1. Auto Summary

AI generates a short summary for a clip or note.

#### 2. Auto Classification

AI recommends which notebook the content belongs to.

Example:

```text
Recommended notebook: Work Notes / Inspiration Inbox / AI Chat Clips
```

#### 3. Auto Tagging

AI generates tags based on the content.

Example:

```text
#work-review #product-thinking #efficiency-tool
```

#### 4. Todo Extraction

AI extracts actionable todos from notes, chat records, meeting notes, or AI conversations.

#### 5. Knowledge Search and Q&A

The user can ask natural language questions such as:

```text
What Xiaohongshu operation ideas did I record last week?
```

The system should answer based on historical notes and cite related notes.

#### 6. Daily Report Generation

Generate a daily report from today's todos, notes, and clips.

Recommended structure:

```text
Completed Today:
1. ...

In Progress:
1. ...

Key Thoughts:
1. ...

Tomorrow's Plan:
1. ...
```

#### 7. Weekly Report Generation

Generate a weekly report from this week's notes, todos, and clips.

Recommended structure:

```text
Key Outcomes:
1. ...

Progress:
1. ...

Problems and Risks:
1. ...

Next Week's Plan:
1. ...
```

#### 8. Content Creation Assistance

Turn scattered inspiration into:

- Xiaohongshu drafts.
- Work proposals.
- Review documents.
- Article outlines.
- Presentation materials.

## 5. MVP Page Plan

## 5.1 Home Dashboard

### Goal

The dashboard should show what needs attention today.

### Page Content

- Today's todos.
- Quick capture input.
- Recent notes.
- Recent clips.
- AI quick actions:
  - Generate today's daily report.
  - Organize unsorted content.
  - Extract todos from notes.
  - Search my notes.

## 5.2 Notebooks Page

### Page Content

- Left: notebook list.
- Middle: note list.
- Right: note editor.

### Core Actions

- Create notebook.
- Create note.
- Edit note.
- AI summarize.
- AI classify.
- AI extract todos.
- Generate related content.

## 5.3 Todo Page

### Page Content

- Today's todos.
- All incomplete todos.
- Completed todos.
- Overdue todos.
- Todos from notes.

### Core Actions

- Create todo.
- Complete todo.
- Set due date.
- Associate todo with note.
- Jump from todo to source note.

## 5.4 Clip Inbox Page

### Goal

The inbox receives all unorganized inspiration and copied content.

### Page Content

- Quick paste area.
- Clip list.
- Source filter.
- AI organization actions.

### Core Actions

- Paste content.
- Select source.
- AI summarize.
- AI classify.
- AI tag.
- AI extract todos.
- Convert to note.

## 5.5 AI Assistant Page

### Goal

Let the user operate the notebook through natural language.

### Example Prompts

- Generate today's daily report.
- Summarize this week's work highlights.
- What recent ideas did I save about Xiaohongshu?
- Extract todos from this chat record.
- Turn these ideas into a Xiaohongshu draft.
- Classify my unsorted clips.

## 6. Data Model Draft

### 6.1 Notebook

```json
{
  "id": "notebook_001",
  "name": "Work Notes",
  "description": "Daily work notes",
  "created_at": "2026-05-26T00:00:00+08:00",
  "updated_at": "2026-05-26T00:00:00+08:00"
}
```

### 6.2 Note

```json
{
  "id": "note_001",
  "notebook_id": "notebook_001",
  "title": "Today's Work Notes",
  "content": "Today I completed...",
  "summary": "AI-generated summary",
  "tags": ["work", "review"],
  "created_at": "2026-05-26T00:00:00+08:00",
  "updated_at": "2026-05-26T00:00:00+08:00"
}
```

### 6.3 Todo

```json
{
  "id": "todo_001",
  "title": "Prepare product proposal",
  "status": "pending",
  "priority": "high",
  "due_date": "2026-05-27",
  "source_note_id": "note_001",
  "created_at": "2026-05-26T00:00:00+08:00",
  "completed_at": null
}
```

### 6.4 Clip

```json
{
  "id": "clip_001",
  "source": "Xiaohongshu",
  "source_url": "",
  "raw_content": "Original clipped content",
  "summary": "AI-generated summary",
  "tags": ["inspiration", "content-creation"],
  "recommended_notebook_id": "notebook_002",
  "created_at": "2026-05-26T00:00:00+08:00"
}
```

## 7. Feature Priority

### P0 Must Have

- Notebook management.
- Note creation and editing.
- Todo creation, completion, and filtering.
- Todo recognition inside notes.
- Manual paste into clip inbox.
- AI summary.
- AI classification.
- AI todo extraction.
- Daily report generation.
- Weekly report generation.
- Local or lightweight database storage.

### P1 Next

- Tag system.
- Full-text search.
- AI Q&A.
- Convert clips to notes.
- Stronger note-todo linking.
- Filter clips by source.
- Generate creative drafts from clips.

### P2 Later

- Browser extension clipping.
- Mobile app.
- Web sync.
- WeChat and Feishu automatic import.
- OCR screenshot capture.
- Team collaboration.
- Permission management.
- Public account system.

## 8. Recommended MVP Implementation

### First Implementation Form

Build a local-first web MVP.

Reasons:

- Lower development cost.
- Fast iteration.
- Easy to evolve into a full web product.
- Convenient for copying and pasting AI chats, Xiaohongshu content, and work messages.

### Suggested Technical Direction

- Frontend: React or Next.js.
- Storage: SQLite, Supabase, or IndexedDB.
- AI: OpenAI API or compatible model provider.
- Editor: Markdown editor or lightweight rich text editor.

## 9. Key User Flows

### Flow 1: Record Work Todo

1. Open dashboard.
2. Type today's tasks in quick input.
3. System creates todos.
4. Todos appear in today's list.
5. User marks tasks as completed.
6. User generates daily report at the end of the day.

### Flow 2: Save AI Chat Inspiration

1. Copy useful content from an AI chat.
2. Paste it into the clip inbox.
3. Click AI summarize.
4. AI generates summary, tags, and category.
5. User confirms and saves it to AI Chat Clips.
6. If actionable items exist, AI creates todos.

### Flow 3: Organize Xiaohongshu Inspiration

1. Copy Xiaohongshu content or link.
2. Paste it into the clip inbox.
3. Select source as Xiaohongshu.
4. AI extracts key points.
5. AI recommends tags and notebook.
6. User converts it to a note or draft.

### Flow 4: Generate Weekly Report

1. Open AI assistant.
2. Enter "Generate this week's weekly report".
3. System reads this week's todos, notes, and clips.
4. AI generates structured weekly report.
5. User edits and saves it to Daily and Weekly Reports.

## 10. Success Metrics

### MVP Qualitative Metrics

- The user can reliably record daily todos.
- The user can quickly save inspiration.
- The user can generate a usable weekly report.
- AI classification is accurate enough for personal use.
- The user is willing to put both tasks and inspiration into this tool.

### Quantitative Metrics

- Daily new notes.
- Daily new todos.
- Weekly generated reports.
- Clip-to-note conversion rate.
- AI-generated content retention rate.
- Search hit rate.

## 11. Iteration Roadmap

### V0.1 Personal Local MVP

- Notes.
- Todos.
- Clip inbox.
- AI summary, classification, and todo extraction.
- Daily and weekly report generation.

### V0.2 Knowledge Management

- Tags.
- Full-text search.
- AI Q&A.
- Clip-to-article or clip-to-proposal generation.

### V0.3 Multi-device and Clipping

- Web account system.
- Cloud sync.
- Browser extension.
- Mobile share capture.

### V0.4 Work Platform Integration

- Feishu message clipping.
- Enhanced WeChat manual import.
- Calendar and task integration.
- Report push.

### V1.0 Public Personal Product

- Complete web app.
- User login.
- Multi-device sync.
- Subscription-ready AI features.
- Template marketplace.

## 12. MVP Scope Recommendation

The first version should focus on five areas:

1. Home dashboard.
2. Notebook and note editor.
3. Todo list.
4. Clip inbox.
5. AI daily and weekly report generation.

The key validation question for the MVP:

> Can the user record tasks, save inspiration, and generate a useful daily report at the end of the day?

If this loop works, the next step is to expand into browser clipping, mobile capture, AI Q&A, and public user accounts.

