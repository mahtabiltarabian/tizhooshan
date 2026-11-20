// Tool 19 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { IfSlipTag } from "@/generators/if-then";
import type { GridTag, LiarTag, VennTag } from "@/generators/logic";
import type { CountTag } from "@/generators/venn-count";
import type { PracticeInfo } from "@/practice/adapter";

export const LOGIC_PRACTICE: PracticeInfo = {
  tool: "logic",
  id: 19,
  href: "/tools/logic/",
  types: [
    { key: "grid", label: "جدول منطقی" },
    { key: "liars", label: "راستگو و دروغگو" },
    { key: "venn", label: "همه و بعضی" },
    { key: "vennNum", label: "ون با عدد" },
    { key: "ifThen", label: "اگر… آنگاه" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    // logic grid
    ignoredNo: "یک سرنخ «نه» را نادیده می‌گیرد",
    ignoredOr: "سرنخ «یکی از این دو» را درست به کار نمی‌برد",
    ignoredYes: "سرنخ «حتماً» را درست به کار نمی‌برد (بقیه سطر و ستون را ✗ نمی‌زند)",
    clash: "به یک نفر دو چیز (یا یک چیز را به دو نفر) می‌دهد",
    incomplete: "جدول را نیمه‌کاره بررسی می‌کند",
    // truth-tellers and liars
    trustedLiar: "حرف یک دروغگو را باور می‌کند",
    doubtedTruth: "یک راستگو را دروغگو می‌گیرد",
    // all and some
    converse: "«همه» را برعکس می‌کند (همه گربه‌ها حیوان‌اند ← همه حیوان‌ها گربه‌اند)",
    someNotAll: "«بعضی» را «فقط بعضی» می‌فهمد",
    tooStrong: "نتیجه‌ای قوی‌تر از جمله‌ها می‌گیرد («همه» یا «هیچ» به جای «بعضی»)",
    impossible: "نتیجه‌ای را می‌پذیرد که با جمله‌ها جور نیست",
    missedValid: "می‌گوید هیچ نتیجه‌ای درنمی‌آید، ولی یکی حتماً درست است",
    notSure: "نتیجه‌ای را می‌پذیرد که شاید درست باشد ولی حتماً نه",
    // Venn diagrams with numbers
    addedNoOverlap: "عدد دایره‌ها را جمع می‌کند و بخش مشترک را کم نمی‌کند",
    totalAsOnly: "عدد کل یک دایره را «فقط همان دایره» می‌گیرد",
    forgotOutside: "کسانی را که بیرون همه دایره‌ها هستند فراموش می‌کند",
    doubleSubtract: "بخش مشترک را دو بار کم می‌کند",
    forgotMiddle: "در سه دایره، بخش وسط (هر سه) را کم نمی‌کند",
    pairAsOnly: "«هم این هم آن» را «فقط این دو» می‌گیرد",
    insideNotOutside: "داخل دایره‌ها را می‌گوید وقتی بیرون خواسته شده",
    otherPart: "بخش «فقط» دایره دیگر را می‌گوید",
    partNotBoth: "یک بخش دیگر را به جای «هر دو» می‌گوید",
    minMax: "کمترین و بیشترین را جابه‌جا می‌گیرد",
    forgotTotal: "فراموش می‌کند که تعداد کل محدود است",
    biggerSet: "بخشی را بزرگ‌تر از دایره کوچک‌تر می‌گیرد",
    // if … then
    affirmConsequent: "پیکان را برعکس می‌خواند (از «نتیجه درست است» می‌گوید «شرط هم درست است»)",
    denyAntecedent: "«نه» را در جهت پیکان جلو می‌برد (از «شرط نادرست است» می‌گوید «نتیجه هم نادرست است»)",
    reversedChain: "در زنجیره پیکان‌ها، جایی برعکس می‌رود",
    missedTollens: "نمی‌بیند که «نادرست» برعکس پیکان برمی‌گردد و جواب معلوم است",
    missedPonens: "نمی‌بیند که «درست» در جهت پیکان جلو می‌رود و جواب معلوم است",
    opposite: "برعکسِ نتیجه درست را می‌گوید",
    unsupported: "جوابی می‌دهد که هیچ پیکانی به آن نمی‌رسد",
    other: "جواب دیگری داد",
  } satisfies Record<GridTag | LiarTag | VennTag | CountTag | IfSlipTag, string>,
};
