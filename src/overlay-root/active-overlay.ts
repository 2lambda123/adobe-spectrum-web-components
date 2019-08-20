/*
Copyright 2018 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import { Placement, OverlayOpenDetail, TriggerInteractions } from './overlay';
import calculatePosition, { PositionResult } from './calculate-position';
import {
    html,
    LitElement,
    TemplateResult,
    CSSResultArray,
    property,
} from 'lit-element';
import styles from './active-overlay.css';

interface CalculatePositionOptions {
    containerPadding: number;
    crossOffset: number;
    flip: boolean;
    offset: number;
    placement: string;
}

const defaultOptions: CalculatePositionOptions = {
    containerPadding: 10,
    crossOffset: 0,
    flip: true,
    offset: 0,
    placement: 'left',
};

export class ActiveOverlay extends LitElement {
    public overlayContent?: HTMLElement;
    public trigger?: HTMLElement;

    private placeholder?: Comment;
    private root?: HTMLElement;

    @property({ reflect: true })
    public state?: 'active' | 'visible' | 'hiding';

    @property({ reflect: true })
    public placement: Placement = 'bottom';

    public offset = 6;
    private position?: PositionResult;
    public interaction: TriggerInteractions = 'hover';

    private timeout?: number;
    private hiddenPromise?: Promise<undefined>;

    public static get styles(): CSSResultArray {
        return [styles];
    }

    private open(openEvent: CustomEvent<OverlayOpenDetail>): void {
        this.extractEventDetail(openEvent);
        this.stealOverlayContent(openEvent.detail.content);

        if (!this.overlayContent) return;

        this.state = 'active';

        this.timeout = window.setTimeout(() => {
            this.state = 'visible';
            delete this.timeout;
        }, openEvent.detail.delay);
    }

    private extractEventDetail(ev: CustomEvent<OverlayOpenDetail>): void {
        this.overlayContent = ev.detail.content;
        this.trigger = ev.detail.trigger;
        this.placement = ev.detail.placement;
        this.offset = ev.detail.offset;
        this.interaction = ev.detail.interaction;
    }

    public dispose(): void {
        delete this.state;

        if (this.timeout) {
            clearTimeout(this.timeout);
            delete this.timeout;
        }

        this.returnOverlayContent();
    }

    private stealOverlayContent(element: HTMLElement): void {
        if (this.placeholder || !element) return;
        if (!this.placeholder) {
            this.placeholder = document.createComment(
                'placeholder for ' + element.nodeName
            );
        }

        if (element.parentElement) {
            element.parentElement.replaceChild(this.placeholder, element);
        }

        this.overlayContent = element;
        this.overlayContent.setAttribute('slot', 'overlay');
        this.appendChild(this.overlayContent);
    }

    private returnOverlayContent(): void {
        if (!this.overlayContent) return;

        this.overlayContent.removeAttribute('slot');

        if (this.placeholder && this.placeholder.parentElement) {
            this.placeholder.parentElement.replaceChild(
                this.overlayContent,
                this.placeholder
            );
        }
        delete this.placeholder;
    }

    private get hasSlotenOverlayContent(): boolean {
        return !!(
            this.overlayContent && this.overlayContent.parentElement === this
        );
    }

    public updateOverlayPosition(): void {
        if (
            !this.trigger ||
            !this.overlayContent ||
            !this.hasSlotenOverlayContent ||
            !this.root ||
            !this.isConnected
        ) {
            return;
        }

        const options: CalculatePositionOptions = {
            containerPadding: 0,
            crossOffset: 0,
            flip: false,
            offset: this.offset,
            placement: this.placement,
        };

        const positionOptions = { ...defaultOptions, ...options };

        this.position = calculatePosition(
            positionOptions.placement,
            this.overlayContent,
            this.trigger,
            this.root,
            positionOptions.containerPadding,
            positionOptions.flip,
            this.root,
            positionOptions.offset,
            positionOptions.crossOffset
        );

        this.style.setProperty('top', `${this.position.positionTop}px`);
        this.style.setProperty('left', `${this.position.positionLeft}px`);
    }

    public hide(): Promise<undefined> {
        if (!this.hiddenPromise) {
            this.hiddenPromise = new Promise((resolve) => {
                // Resolve after the next CSS animation starts and completes
                const animationStartHandler = (): void => {
                    this.removeEventListener(
                        'animationstart',
                        animationStartHandler
                    );
                    const animationEndedHandler = (): void => {
                        this.removeEventListener(
                            'animationend',
                            animationEndedHandler
                        );
                        this.removeEventListener(
                            'animationcancel',
                            animationEndedHandler
                        );
                        resolve();
                    };
                    this.addEventListener(
                        'animationend',
                        animationEndedHandler
                    );
                };
                this.addEventListener('animationstart', animationStartHandler);
                this.state = 'hiding';
            });
        }
        return this.hiddenPromise;
    }

    private onSlotChange(): void {
        this.updateOverlayPosition();
    }

    public connectedCallback(): void {
        super.connectedCallback();
        this.updateOverlayPosition();
    }

    public disconnectedCallback(): void {
        super.disconnectedCallback();
    }

    public render(): TemplateResult {
        return html`
            <slot @slotchange=${this.onSlotChange} name="overlay"></slot>
        `;
    }

    public static create(
        openEvent: CustomEvent<OverlayOpenDetail>,
        root: HTMLElement
    ): ActiveOverlay {
        const overlay = document.createElement(
            'active-overlay'
        ) as ActiveOverlay;

        if (openEvent.detail.content) {
            overlay.root = root;
            overlay.open(openEvent);
        }

        return overlay;
    }
}
