import type { InjectionKey } from 'vue'

/** Provided by <UiFormSection> so controls inside its tinted card can switch to a white track. */
export const IN_FORM_SECTION: InjectionKey<boolean> = Symbol('in-form-section')
