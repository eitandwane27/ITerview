import { createElement, useEffect, useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Briefcase, Check, ChevronDown } from 'lucide-react';
import './DashboardRoleSelect.css';

export default function DashboardRoleSelect({
  id,
  labelledBy,
  describedBy,
  invalid = false,
  options,
  value,
  onChange,
  disabled = false,
  icon = Briefcase,
  title,
}) {
  const listId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState('');
  const [activeInput, setActiveInput] = useState('keyboard');
  const [portalContainer, setPortalContainer] = useState(null);
  const [bottomCollisionPadding, setBottomCollisionPadding] = useState(16);
  const enabledOptions = options.filter((option) => !option.disabled);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const expanded = open && !disabled;

  function changeOpen(nextOpen) {
    setOpen(nextOpen && !disabled);
    searchRef.current = { text: '', time: 0 };
    if (nextOpen) {
      setActiveInput('keyboard');
      // Escape the onboarding card's clipping while inheriting dashboard tokens.
      setPortalContainer(triggerRef.current?.closest('.db-root') || null);
      const clearance = getComputedStyle(document.body).getPropertyValue('--nikki-companion-clearance');
      setBottomCollisionPadding(Number.parseFloat(clearance) || 16);
      setActiveValue(enabledOptions.find((option) => option.value === value)?.value ||
        enabledOptions[0]?.value || '');
    }
  }

  function choose(nextValue) {
    if (!enabledOptions.some((option) => option.value === nextValue)) return;
    onChange(nextValue);
    changeOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    // Hover highlights clipped rows without moving the list beneath the pointer.
    if (!expanded || activeInput !== 'keyboard') return;
    const menu = menuRef.current;
    const active = menu?.querySelector('[data-active="true"]');
    if (!active) return;
    // Scroll only the popup, never the dashboard behind it.
    if (active.offsetTop < menu.scrollTop) menu.scrollTop = active.offsetTop;
    else if (active.offsetTop + active.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = active.offsetTop + active.offsetHeight - menu.clientHeight;
    }
  }, [expanded, activeValue, activeInput]);

  function handleKeyDown(event) {
    if (disabled || !enabledOptions.length || event.ctrlKey || event.metaKey) return;
    setActiveInput('keyboard');
    const index = enabledOptions.findIndex((option) => option.value === activeValue);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) {
        changeOpen(true);
        if (event.key === 'ArrowUp' && !value) setActiveValue(enabledOptions.at(-1).value);
      } else if (event.altKey && event.key === 'ArrowUp') {
        changeOpen(false);
      } else {
        const nextIndex = Math.max(0, Math.min(enabledOptions.length - 1,
          index + (event.key === 'ArrowDown' ? 1 : -1)));
        setActiveValue(enabledOptions[nextIndex].value);
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!expanded) changeOpen(true);
      setActiveValue(event.key === 'Home' ? enabledOptions[0].value : enabledOptions.at(-1).value);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded) choose(activeValue);
      else changeOpen(true);
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      changeOpen(false);
    } else if (event.key === 'Tab') {
      // Let normal tab order take the user to the next dashboard control.
      changeOpen(false);
    } else if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - searchRef.current.time < 700 ? searchRef.current.text : '') +
        event.key.toLocaleLowerCase();
      searchRef.current = { text, time: now };
      const prefix = [...text].every((character) => character === text[0]) ? text[0] : text;
      const start = prefix.length === 1 ? index + 1 : Math.max(index, 0);
      const ordered = [...enabledOptions.slice(start), ...enabledOptions.slice(0, start)];
      const match = ordered.find((option) => option.label.toLocaleLowerCase().startsWith(prefix));
      if (!expanded) changeOpen(true);
      // Opening clears the buffer; retain this keystroke for multi-letter lookup.
      searchRef.current = { text, time: now };
      if (match) setActiveValue(match.value);
    }
  }

  return (
    <Popover.Root open={expanded} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className="db-role-select__trigger"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && activeValue ? `${listId}-${activeValue}` : undefined}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          title={title}
          data-value={value}
          data-placeholder={!value || undefined}
          onKeyDown={handleKeyDown}
        >
          {createElement(icon, { size: 17, className: 'db-role-select__icon', 'aria-hidden': true })}
          <span className="db-role-select__value">{selectedOption?.label}</span>
          <ChevronDown size={17} className="db-role-select__chevron" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="db-role-select__menu"
          align="start"
          sideOffset={8}
          collisionPadding={{ top: 16, right: 16, bottom: bottomCollisionPadding, left: 16 }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.filter((option) => option.value).map((option) => (
            <div
              key={option.value}
              id={`${listId}-${option.value}`}
              role="option"
              aria-selected={value === option.value}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              className="db-role-select__option"
              data-active={activeValue === option.value}
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse' && !option.disabled) {
                  setActiveInput('pointer');
                  setActiveValue(option.value);
                }
              }}
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={16} aria-hidden="true" />}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
