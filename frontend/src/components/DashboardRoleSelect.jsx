import { createElement, useId, useLayoutEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Briefcase, Check, ChevronDown } from 'lucide-react';
import './DashboardRoleSelect.css';

export default function DashboardRoleSelect({
  id,
  labelledBy,
  describedBy,
  invalid = false,
  groups,
  options = groups?.flatMap(group => group.options) ?? [],
  value,
  onChange,
  disabled = false,
  required = false,
  autoFocus = false,
  icon = Briefcase,
  title,
  menuClassName,
}) {
  const listId = useId();
  const triggerRef = useRef(null);
  const [menu, setMenu] = useState(null);
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
      // Keep menus inside native dialogs while escaping scrollable content.
      const container = triggerRef.current?.closest('dialog, .db-root, .mictest-root, .admin-page');
      setPortalContainer(container || null);
      const clearance = getComputedStyle(document.body).getPropertyValue('--nikki-companion-clearance');
      setBottomCollisionPadding(container?.matches('dialog') ? 16 : Number.parseFloat(clearance) || 16);
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

  useLayoutEffect(() => {
    // Hover highlights clipped rows without moving the list beneath the pointer.
    if (!expanded || activeInput !== 'keyboard') return;
    const active = menu?.querySelector('[data-active="true"]');
    if (!active) return;
    // Scroll only the popup, never the dashboard behind it.
    const headingHeight = active.closest('.db-role-select__group')?.firstElementChild.offsetHeight ?? 0;
    const visibleTop = active.offsetTop - headingHeight;
    if (visibleTop < menu.scrollTop) menu.scrollTo({ top: visibleTop });
    else if (active.offsetTop + active.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTo({ top: active.offsetTop + active.offsetHeight - menu.clientHeight });
    }
  }, [menu, expanded, activeValue, activeInput]);

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

  function renderOptions(items) {
    return items.filter((option) => option.value).map((option) => (
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
        <span>{option.label}{option.status}</span>
        {value === option.value && <Check size={16} aria-hidden="true" />}
      </div>
    ));
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
          aria-required={required || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          title={title}
          data-value={value}
          data-placeholder={!value || undefined}
          onKeyDown={handleKeyDown}
        >
          {icon && createElement(icon, { size: 17, className: 'db-role-select__icon', 'aria-hidden': true })}
          <span className="db-role-select__value">{selectedOption?.label}</span>
          <ChevronDown size={17} className="db-role-select__chevron" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          ref={setMenu}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className={menuClassName ? `db-role-select__menu ${menuClassName}` : 'db-role-select__menu'}
          align="start"
          sideOffset={8}
          collisionBoundary={portalContainer?.matches('dialog') ? portalContainer : undefined}
          collisionPadding={{ top: 16, right: 16, bottom: bottomCollisionPadding, left: 16 }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
        >
          {groups ? groups.map(group => (
            <div key={group.label} role="group" aria-label={group.label} className="db-role-select__group">
              <div className="db-role-select__group-label" aria-hidden="true">{group.label}</div>
              {renderOptions(group.options)}
            </div>
          )) : renderOptions(options)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
