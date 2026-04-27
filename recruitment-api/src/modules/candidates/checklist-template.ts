export const CHECKLIST_REQUIRED_BY_STATUS: Record<string, Array<{ id: string; label: string }>> = {
  new: [
    { id: 'profileFilled', label: "Заповнено ПІБ, телефон, позицію, місто, джерело" },
    { id: 'duplicatesChecked', label: 'Перевірено дублікати в базі' },
    { id: 'firstCommentAdded', label: 'Додано початковий коментар' },
  ],
  contacted: [
    { id: 'firstContactDone', label: 'Проведено первинний контакт' },
    { id: 'conditionsClarified', label: 'Уточнено графік/умови/очікування' },
    { id: 'contactResultLogged', label: 'Зафіксовано результат контакту' },
  ],
  interview: [
    { id: 'interviewScheduled', label: 'Узгоджено дату і час співбесіди' },
    { id: 'instructionsSent', label: 'Надіслано інструкції кандидату' },
    { id: 'feedbackLogged', label: 'Після співбесіди внесено фідбек' },
  ],
  offer: [
    { id: 'offerTermsAgreed', label: 'Узгоджено умови оферу' },
    { id: 'offerConfirmed', label: 'Кандидат підтвердив офер' },
    { id: 'documentsDeadlineSet', label: 'Узгоджено дедлайн по документах' },
  ],
  hired: [
    { id: 'docsReceived', label: 'Отримано пакет документів' },
    { id: 'startDateConfirmed', label: 'Підтверджено дату виходу' },
    { id: 'handoffCompleted', label: 'Передано в HR/оформлення' },
  ],
};
