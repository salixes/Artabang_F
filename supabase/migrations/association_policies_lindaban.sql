-- ============================================================================
-- MIGRATION — Association Policies: the by-laws and policies of the Lindaban Farmers Association.
--
--   * adds the 16 policy cards (Articles I to XV + Policies from the Minutes of Oct 24, 2014)
--     to Policy Management (president) and Association Policies (farmers)
--   * they are saved for ALL associations (association = empty), so the members of LIFA and
--     Lindasan can read them. The president can change a policy's association when editing it.
--   * the president can add, edit and delete policies; farmers can only read them
--     (already enforced by the policies_write_president rule in schema.sql)
--   * adds sort_order so the policies stay in article order, and updated_at
-- Run it once. If you run it again it does NOT add the same cards twice.
-- ============================================================================
alter table public.policies add column if not exists sort_order integer not null default 0;
alter table public.policies add column if not exists updated_at timestamptz;

insert into public.policies (association_id, title, icon, body, sort_order)
select null, v.title, v.icon, v.body, v.ord
from (values
  (1, $p$Objectives (Art. I)$p$, 'fa-bullseye', $p$1. Promote cooperation and friendly relations among members and their families.
2. Help members solve their problems through lending from the association’s funds.
3. Advance the economic, social, and educational conditions of members.
4. Improve and promote small skills among members so they can earn a living.$p$),
  (2, $p$Name and Office (Art. II-III)$p$, 'fa-building', $p$5. The name is “Lindaban Farmers Association.”
6. The office address is Lindaban, Manolo Fortich, Bukidnon.$p$),
  (3, $p$Membership (Art. IV)$p$, 'fa-users', $p$7. Members are farmers in Lindaban, Manolo Fortich, Bukidnon.
8. Requirements: agree with the association’s purpose and by-laws, and pay the membership fee.
9. Member rights: vote on all association matters, attend and take part in all meetings, and avail of all association benefits.$p$),
  (4, $p$Board of Trustees (Art. V)$p$, 'fa-people-group', $p$10. The board manages the association and has 7 to 9 members elected from the members.
11. If a vacancy happens while the board still has a quorum, the replacement serves the unexpired term.$p$),
  (5, $p$Authority and Power (Art. VI)$p$, 'fa-gavel', $p$12. The association is subordinate to the municipality’s program and operates under its authority.
13. The board can: supervise and represent the association, set rules and regulations, generate financial and other resources, set guidelines for deposits, spending, and lending of funds, and keep the member roll and the income and expense records.
14. The association’s influence is to be used primarily for the joint benefit of the association.
15. The association’s work must not be allowed to negatively affect (the sentence is incomplete in the document).$p$),
  (6, $p$Council and Arbiter (Art. VII)$p$, 'fa-handshake', $p$16. The board may assist members case by case, when the member requests it. This includes planning trainings or seminars, and helping with problems too hard for one member alone. Its plans are only recommended to the member as guidance.
17. The board can act as a friendly arbiter in internal disputes of a moral or spiritual nature. Its decision is executory and only implementable by the association.$p$),
  (7, $p$Officers (Art. VIII)$p$, 'fa-user-tie', $p$18. Officers are the President, Vice President, Secretary, Treasurer, Auditor, and Press Relations Officer(s).
19. President: chief executive officer, presides over all meetings of members and the board, and directs the association for the fiscal year.
20. Secretary: gives all required notices, keeps the minutes of member and board meetings, keeps the seal and affixes it on papers, keeps the members register and correspondence files, and does other duties the board assigns.
21. Treasurer: in charge of funds, receipts, and disbursements, keeps the money and valuables as the board designates, keeps the books of accounts, and is bonded in an amount the board sets.
22. Auditor: audits the books and disbursements, reports findings on funds and properties to the general assembly, and works with the Treasurer to set up a system that safeguards funds and makes sure rules are followed.
23. Press Relations Officer: informs and notifies all members about the association’s activities.$p$),
  (8, $p$Suspension and Termination (Art. IX)$p$, 'fa-user-slash', $p$24. Any member can file a written complaint against another member with the Secretary.
25. The board calls a special meeting to consider the charges.
26. Suspending a member needs the affirmative vote of all the trustees.
27. If the penalty is expulsion, it needs the affirmative vote of a majority of all members.$p$),
  (9, $p$Funds (Art. X)$p$, 'fa-coins', $p$28. Funds come from membership fees, monthly dues, stock shares, special assessments, gifts or donations, and percentage.
29. Withdrawals (by check or other instrument) are signed by the Treasurer and countersigned by the President. The board can designate other signatories if needed.
30. Fiscal year: October 1 to December 31 (as written).$p$),
  (10, $p$Meetings (Art. XI)$p$, 'fa-calendar-check', $p$31. Regular general meeting is every third Friday of the month (monthly meeting).
32. The board meets preferably on the same day as the general meeting.
33. A special board meeting can be called at the request of any two trustees, and must be held within 10 days of the request.$p$),
  (11, $p$Quorum (Art. XI, Sec. 3)$p$, 'fa-check-to-slot', $p$34. Members’ meetings need a majority of members for quorum.
35. Board meetings need a majority of trustees for quorum.
36. Every decision of a quorum (members or board) is valid as a corporate act.$p$),
  (12, $p$Procedures (Art. XII)$p$, 'fa-list-check', $p$37. Resolutions are made, seconded, restated, discussed, and passed by majority vote of the quorum at an official meeting.
38. The presiding officer can’t vote, except under imperative or peremptory procedure.$p$),
  (13, $p$Committees (Art. XIII)$p$, 'fa-sitemap', $p$39. Community Resources: generates resources for the association’s programs.
40. Training: conducts trainings and workshops, coordinating with concerned agencies.
41. Recruitment: develops and runs programs for members’ and families’ basic social needs.
42. Secretariat: handles documentation and administrative services.
43. Special Affairs: handles special projects and activities, including drafting the constitution, by-laws, policies, and rules.$p$),
  (14, $p$Amendment (Art. XIV)$p$, 'fa-pen-to-square', $p$44. By-laws can be amended or repealed by majority vote of members at a regular meeting or a meeting called for that purpose, as long as a copy of the proposed amendment was given at the last meeting.$p$),
  (15, $p$Adoption (Art. XV)$p$, 'fa-stamp', $p$45. The by-laws are adopted by majority vote of members at a meeting called for that purpose.
46. The board certifies a true copy of the duly adopted by-laws.
47. The by-laws take effect once adopted and certified.$p$),
  (16, $p$Policies from the Minutes (October 24, 2014)$p$, 'fa-file-lines', $p$48. Membership fee: Php 50.00.
49. Monthly dues: Php 10.00, collection started October 2014.
50. Meetings: once a month, every third Friday, 9:30 AM at the barangay hall.
51. Special meetings can be called upon members’ written request.
52. Fine for absence from a meeting: Php 25.00. Only valid reasons (like medical or a BHW meeting) are excused, and sending a representative is also considered.
53. The association will register with DOLE, with a registration fee of Php 70.00.$p$)
) as v(ord, title, icon, body)
where not exists (
  select 1 from public.policies p where p.title = v.title and p.association_id is null
);
