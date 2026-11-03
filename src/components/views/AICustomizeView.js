import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

// Structured background fields. Each maps to a preference key in storage and is
// sent to the AI as its own labelled section so answers draw on the user's real experience.
const BACKGROUND_FIELDS = [
    {
        key: 'backgroundAbout',
        label: 'About me / resume',
        placeholder:
            'Paste your resume or summarize it: current and past roles, companies, years, key skills, education, notable results with numbers.',
        help: 'Who you are. The AI only uses facts from here and never invents experience.',
        rows: 8,
    },
    {
        key: 'backgroundTargetRole',
        label: 'Target role / job description',
        placeholder: 'Company, role title, the job description, what the team cares about, what you know about the interviewers.',
        help: 'Answers are tailored to what this role values.',
        rows: 5,
    },
    {
        key: 'backgroundStories',
        label: 'Key projects & stories',
        placeholder:
            'Your best stories, ideally as Situation / Task / Action / Result. e.g. "Led the checkout redesign at X: conversion +12% in 3 months; had to align eng, design and legal..."',
        help: 'The AI picks the most relevant story for each question.',
        rows: 8,
    },
    {
        key: 'backgroundStyle',
        label: 'Answer style',
        placeholder: 'e.g. "Answer in Chinese", "Up to 5 bullet points", "Confident but not arrogant", "Always end with a short question back".',
        help: 'Overrides the default format (length, language, tone).',
        rows: 3,
    },
    {
        key: 'customPrompt',
        label: 'Other instructions',
        placeholder: 'Anything else: topics to avoid, salary expectations, constraints...',
        help: '',
        rows: 3,
    },
];

export class AICustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .form-grid {
                display: flex;
                flex-direction: column;
                gap: var(--space-lg);
            }
            textarea.control {
                min-height: 0;
                resize: vertical;
            }
            .intro {
                color: var(--text-muted);
                font-size: var(--font-size-sm);
                line-height: 1.5;
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        _values: { state: true },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this._values = {};
        this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            const prefs = await cheatingDaddy.storage.getPreferences();
            const values = {};
            for (const field of BACKGROUND_FIELDS) {
                values[field.key] = prefs[field.key] || '';
            }
            this._values = values;
        } catch (error) {
            console.error('Error loading AI customize storage:', error);
        }
    }

    _handleProfileChange(e) {
        this.onProfileChange(e.target.value);
    }

    async _saveField(key, value) {
        this._values = { ...this._values, [key]: value };
        await cheatingDaddy.storage.updatePreference(key, value);
    }

    render() {
        const profiles = [
            { value: 'interview', label: 'Job Interview' },
            { value: 'sales', label: 'Sales Call' },
            { value: 'meeting', label: 'Business Meeting' },
            { value: 'presentation', label: 'Presentation' },
            { value: 'negotiation', label: 'Negotiation' },
            { value: 'exam', label: 'Exam Assistant' },
        ];

        return html`
            <div class="unified-page">
                <div class="unified-wrap">
                    <div>
                        <div class="page-title">AI Context</div>
                        <div class="intro">
                            Tell the AI who you are. Answers are written in your voice, from your real experience, instead of generic advice. Changes
                            apply when you start the next session.
                        </div>
                    </div>

                    <section class="surface">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Profile</label>
                                <select class="control" .value=${this.selectedProfile} @change=${this._handleProfileChange}>
                                    ${profiles.map(profile => html`<option value=${profile.value}>${profile.label}</option>`)}
                                </select>
                            </div>
                            ${BACKGROUND_FIELDS.map(
                                field => html`
                                    <div class="form-group vertical">
                                        <label class="form-label">${field.label}</label>
                                        <textarea
                                            class="control"
                                            rows=${field.rows}
                                            placeholder=${field.placeholder}
                                            .value=${this._values[field.key] || ''}
                                            @input=${e => this._saveField(field.key, e.target.value)}
                                        ></textarea>
                                        ${field.help ? html`<div class="form-help">${field.help}</div>` : ''}
                                    </div>
                                `
                            )}
                        </div>
                    </section>
                </div>
            </div>
        `;
    }
}

customElements.define('ai-customize-view', AICustomizeView);
