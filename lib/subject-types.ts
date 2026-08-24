export interface SubjectTypeOption {
  code: string;
  value: string;
  nameSi: string;
  nameEn: string;
  label: string;
}

export const SUBJECT_TYPE_OPTIONS: SubjectTypeOption[] = [
  {
    code: "01",
    value: "01 - ශාඛා ප්‍රධානී රාජකාරී",
    nameSi: "ශාඛා ප්‍රධානී රාජකාරී",
    nameEn: "Branch Head Duties",
    label: "01 - ශාඛා ප්‍රධානී රාජකාරී (Branch Head Duties)",
  },
  {
    code: "02",
    value: "02 - අධ්‍යාපන අමාත්‍යාංශය",
    nameSi: "අධ්‍යාපන අමාත්‍යාංශය",
    nameEn: "Ministry of Education",
    label: "02 - අධ්‍යාපන අමාත්‍යාංශය (Ministry of Education)",
  },
  {
    code: "03",
    value: "03 - ශ්‍රී ජයවර්ධනපුර හා හෝමාගම කලාපය",
    nameSi: "ශ්‍රී ජයවර්ධනපුර හා හෝමාගම කලාපය",
    nameEn: "Sri Jayawardenepura & Homagama Zone",
    label: "03 - ශ්‍රී ජයවර්ධනපුර හා හෝමාගම කලාපය (Sri Jayawardenepura & Homagama Zone)",
  },
  {
    code: "04",
    value: "04 - කොළඹ කලාපය",
    nameSi: "කොළඹ කලාපය",
    nameEn: "Colombo Zone",
    label: "04 - කොළඹ කලාපය (Colombo Zone)",
  },
  {
    code: "05",
    value: "05 - ගම්පහ දිස්ත්‍රික්කය",
    nameSi: "ගම්පහ දිස්ත්‍රික්කය",
    nameEn: "Gampaha District",
    label: "05 - ගම්පහ දිස්ත්‍රික්කය (Gampaha District)",
  },
  {
    code: "06",
    value: "06 - කළුතර දිස්ත්‍රික්කය හා පිළියන්දල කලාපය",
    nameSi: "කළුතර දිස්ත්‍රික්කය හා පිළියන්දල කලාපය",
    nameEn: "Kalutara District & Piliyandala Zone",
    label: "06 - කළුතර දිස්ත්‍රික්කය හා පිළියන්දල කලාපය (Kalutara District & Piliyandala Zone)",
  },
  {
    code: "07",
    value: "07 - මාතර දිස්ත්‍රික්කය හා හම්බන්තොට දිස්ත්‍රික්කය",
    nameSi: "මාතර දිස්ත්‍රික්කය හා හම්බන්තොට දිස්ත්‍රික්කය",
    nameEn: "Matara District & Hambantota District",
    label: "07 - මාතර දිස්ත්‍රික්කය හා හම්බන්තොට දිස්ත්‍රික්කය (Matara District & Hambantota District)",
  },
  {
    code: "08",
    value: "08 - මධ්‍යම පළාත",
    nameSi: "මධ්‍යම පළාත",
    nameEn: "Central Province",
    label: "08 - මධ්‍යම පළාත (Central Province)",
  },
  {
    code: "09",
    value: "09 - සබරගමුව පළාත",
    nameSi: "සබරගමුව පළාත",
    nameEn: "Sabaragamuwa Province",
    label: "09 - සබරගමුව පළාත (Sabaragamuwa Province)",
  },
  {
    code: "10",
    value: "10 - උතුරු පළාත හා නැගෙනහිර පළාත",
    nameSi: "උතුරු පළාත හා නැගෙනහිර පළාත",
    nameEn: "Northern Province & Eastern Province",
    label: "10 - උතුරු පළාත හා නැගෙනහිර පළාත (Northern & Eastern Province)",
  },
  {
    code: "11",
    value: "11 - ගාල්ල දිස්ත්‍රික්කය",
    nameSi: "ගාල්ල දිස්ත්‍රික්කය",
    nameEn: "Galle District",
    label: "11 - ගාල්ල දිස්ත්‍රික්කය (Galle District)",
  },
  {
    code: "12",
    value: "12 - වයඹ පළාත",
    nameSi: "වයඹ පළාත",
    nameEn: "North Western Province",
    label: "12 - වයඹ පළාත (North Western Province)",
  },
  {
    code: "13",
    value: "13 - විද්‍යාපීඨ",
    nameSi: "විද්‍යාපීඨ",
    nameEn: "National Colleges of Education (Vidya Peeta)",
    label: "13 - විද්‍යාපීඨ (National Colleges of Education)",
  },
  {
    code: "14",
    value: "14 - ඌව පළාත",
    nameSi: "ඌව පළාත",
    nameEn: "Uva Province",
    label: "14 - ඌව පළාත (Uva Province)",
  },
  {
    code: "15",
    value: "15 - උතුරු මැද පළාත",
    nameSi: "උතුරු මැද පළාත",
    nameEn: "North Central Province",
    label: "15 - උතුරු මැද පළාත (North Central Province)",
  },
];

export function getSubjectTypeLabel(codeOrValue: string | undefined | null): string {
  if (!codeOrValue) return "—";
  const found = SUBJECT_TYPE_OPTIONS.find(
    (opt) =>
      opt.code === codeOrValue ||
      opt.value === codeOrValue ||
      opt.nameSi === codeOrValue ||
      opt.nameEn === codeOrValue ||
      codeOrValue.startsWith(opt.code)
  );
  return found ? found.label : codeOrValue;
}
