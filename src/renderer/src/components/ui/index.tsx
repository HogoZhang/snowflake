import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'sm'

export function Button({
  className,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}): ReactElement {
  return <button className={cx('ui-button', `ui-button-${variant}`, `ui-button-${size}`, className)} {...props} />
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return <input className={cx('ui-control', className)} {...props} />
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return <select className={cx('ui-control', 'ui-select', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea className={cx('ui-control', 'ui-textarea', className)} {...props} />
}

export function Card<T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: T
}): ReactElement {
  const Component = (as ?? 'div') as ElementType
  return <Component className={cx('ui-card', className)} {...props} />
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'secondary' | 'success' | 'danger'
}): ReactElement {
  return <span className={cx('ui-badge', `ui-badge-${tone}`, className)} {...props} />
}
