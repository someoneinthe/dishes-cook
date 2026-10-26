import type {
  ScrollViewInstance,
  TextInputInstance,
  TextInstance,
  ViewInstance,
} from 'react-native';
import { AccessibilityInfo } from 'react-native';
import type { RecipeKind } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { TimeDrafts } from './components/recipe-time-fields';
import { scrollToTop } from './hooks/use-keep-at-top';
import { parseMinutes } from './minutes';
import { parseMonths } from './months';

// The recipe form's fields (recipe-form-screen.tsx): the wrong times and the first wrong field, shown
// and focused on Save.

// The time fields, in the order shown (a dish's cooking and a drink's maturation share a place).
const TIME_FIELD_ORDER: readonly (keyof TimeDrafts)[] = ['prep', 'cook', 'maturation'];

// A field Save found wrong: a text field, or a question to answer.
type InvalidField = Readonly<{ input: TextInputInstance } | { question: TextInstance }>;

type InvalidFieldSearch = Readonly<{
  amountRefMap: ReadonlyMap<number, TextInputInstance>;
  choiceRefMap: ReadonlyMap<number, TextInstance>;
  invalidIdList: readonly number[];
  selectedList: readonly Ingredient[];
  // The first wrong time's field, if any.
  timeInput: null | TextInputInstance | undefined;
  // The title's field when it's empty.
  titleInput: null | TextInputInstance | undefined;
  undecidedIdList: readonly number[];
}>;

// The first wrong field from the top: the title, then the ingredients in order (their amount, or
// the question whether a new one is an existing one).
export function firstInvalidField({
  amountRefMap,
  choiceRefMap,
  invalidIdList,
  selectedList,
  timeInput,
  titleInput,
  undecidedIdList,
}: InvalidFieldSearch): InvalidField | undefined {
  // In the order shown: the title, the times, then the ingredients.
  const fieldInput = titleInput ?? timeInput;
  if (fieldInput) {
    return { input: fieldInput };
  }
  const wrong = selectedList.find(
    ({ id }) => invalidIdList.includes(id) || undecidedIdList.includes(id),
  );
  if (!wrong) {
    return undefined;
  }
  const input = invalidIdList.includes(wrong.id) ? amountRefMap.get(wrong.id) : undefined;
  if (input) {
    return { input };
  }
  const question = choiceRefMap.get(wrong.id);
  return question ? { question } : undefined;
}

// The field of the first wrong time, in the order shown: preparation, then cooking or maturation.
export function firstWrongTime(
  invalidList: readonly (keyof TimeDrafts)[],
  inputs: Readonly<Record<keyof TimeDrafts, null | TextInputInstance>>,
): null | TextInputInstance | undefined {
  const field = TIME_FIELD_ORDER.find((name) => invalidList.includes(name));
  return field === undefined ? undefined : inputs[field];
}

// Keeps a row's element by ingredient id while it's on screen.
export function keepRef<T>(refMap: Map<number, T>, id: number, element: null | T) {
  if (element) {
    refMap.set(id, element);
  } else {
    refMap.delete(id);
  }
}

// The typed times as minutes, and a drink's maturation as months (null: none), and the fields
// that aren't a usable time. A drink has no cooking time, a dish no maturation.
export function readTimes(drafts: TimeDrafts, kind: RecipeKind) {
  const timeMap = {
    cook: kind === 'dish' ? parseMinutes(drafts.cook) : null,
    maturation: kind === 'drink' ? parseMonths(drafts.maturation) : null,
    prep: parseMinutes(drafts.prep),
  };
  return {
    cookMinutes: timeMap.cook,
    invalidList: TIME_FIELD_ORDER.filter((field) => timeMap[field] === undefined),
    maturationMonths: timeMap.maturation,
    prepMinutes: timeMap.prep,
  };
}

// Scrolls a wrong field into view and gives it the focus: the keyboard's for a text field, the
// screen reader's for a question.
export function showField(
  field: InvalidField,
  scrollView: null | ScrollViewInstance,
  content: null | ViewInstance,
) {
  scrollToTop('input' in field ? field.input : field.question, scrollView, content);
  if ('input' in field) {
    field.input.focus();
  } else {
    AccessibilityInfo.sendAccessibilityEvent(field.question, 'focus');
  }
}
