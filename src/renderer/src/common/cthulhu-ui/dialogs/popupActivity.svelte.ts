/** Open modal surfaces defer unsolicited update notifications until their workflows finish. */
export const popupActivity = $state({ modalCount: 0 })
