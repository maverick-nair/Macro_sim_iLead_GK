"""
Builds the Client Trust demo storyline (D141) from Sales Elevator's tested mechanics: the same team values,
actions and triggers in a software company's account team, with people dynamics, four business variables,
four choice events (short term revenue against customer trust, wellbeing against delivery, cost against
capability, transparency against confidentiality), follow ups that depend on earlier choices, and three stakeholders
outside the team (D165: the client's account lead, the CFO and a peer in delivery) whose relationships the choices move
and who ask for things by a deadline.

    python3 scripts/storyline/client-trust.py

writes src/engine/storylines/client-trust.json. Then `npm run calibrate -- client-trust` tunes its funnel
buffer and leads, as for any storyline. Running this again resets them to Sales Elevator's.
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[2]
se = json.loads((root / 'src/engine/storylines/sales-elevator.json').read_text(encoding='utf8'))

STAGES = {'leads': 'prospect', 'qualify': 'discover', 'proposal': 'demo', 'negotiation': 'propose', 'conversion': 'close'}
STAGE_TEXT = {
    'prospect': ('Prospect', 'Finds companies that fit and books first calls, so the pipeline never runs dry.', 'Research, energy for outreach and resilience after a no.'),
    'discover': ('Discover', 'Learns what each client is trying to fix and whether the platform can fix it.', 'Good questions, careful listening and sound judgment.'),
    'demo': ('Demo', 'Shows the platform working on the client\'s own problem.', 'Product knowledge, clear storytelling and attention to detail.'),
    'propose': ('Propose', 'Works through price, terms and the client\'s objections.', 'Composure, persuasion and knowing where the limits are.'),
    'close': ('Close', 'Signs the contract and hands the client to onboarding with a clean promise.', 'Follow through, relationships and keeping promises.'),
}
PEOPLE = {
    'kent': ('arjun', 'Arjun Mehta', 'Prospecting Specialist'), 'beth': ('claire', 'Claire Dunn', 'Prospecting Specialist'),
    'justin': ('marcus', 'Marcus Lee', 'Discovery Analyst'), 'derick': ('tomas', 'Tomas Novak', 'Discovery Analyst'),
    'green': ('femi', 'Femi Adeyemi', 'Solutions Consultant'), 'lowe': ('ravi', 'Ravi Iyer', 'Solutions Consultant'),
    'jack': ('owen', 'Owen Brooks', 'Proposal Lead'), 'peter': ('hugo', 'Hugo Martin', 'Proposal Lead'),
    'ruth': ('nadia', 'Nadia Rahman', 'Account Executive'), 'mandy': ('lena', 'Lena Fischer', 'Account Executive'),
}


def words(text: str) -> str:
    """Moves Sales Elevator's copy into the new company: names, rivals and the product."""
    for old, (_, name, _) in PEOPLE.items():
        first = name.split(' ')[0]
        text = re.sub(rf'\b{old.capitalize()}\b', first, text)
    text = text.replace('Beta Elevators', 'Cirrus Systems').replace("Innov8 Inc.", 'Northwind Cloud').replace('Innov8', 'Northwind')
    text = re.sub(r'\belevators?\b', 'software', text, flags=re.I)
    return text


def person(p: dict, new_id: str | None = None, name: str | None = None, title: str | None = None) -> dict:
    q = json.loads(words(json.dumps(p)))
    if new_id:
        q['id'], q['name'], q['title'] = new_id, name, title
    q['homeStage'] = STAGES[p['homeStage']]
    q['byStage'] = {STAGES[k]: v for k, v in p['byStage'].items()}
    return q


members = [person(m, *PEOPLE[m['id']]) for m in se['members']]
candidates = [person(c) for c in se['candidates']]
stages = [{**s, 'key': STAGES[s['key']], 'name': STAGE_TEXT[STAGES[s['key']]][0], 'about': STAGE_TEXT[STAGES[s['key']]][1], 'suits': STAGE_TEXT[STAGES[s['key']]][2]} for s in se['stages']]

# Actions: Sales Elevator's, with what they cost the budget (D136).
actions = json.loads(words(json.dumps(se['actions'])))
COSTS = {('energize', 'team_lunch'): -1500, ('energize', 'team_building'): -5000, ('training', 'three_day'): -4000, ('training', 'one_week'): -7000, ('hire', 'interview'): -12000, ('reward', 'reward'): -2000}
for a in actions:
    for o in a['options']:
        c = COSTS.get((a['key'], o['key']))
        if c:
            o['business'] = {'always': {'variables': {'budget': c}}}
    if a['key'] == 'training':
        for o in a['options']:
            o['business']['m0'] = {'variables': {'quality': 2}}

body = lambda s: {'he': s, 'she': s}
T = lambda team: 'team' if team else 'member'


def opt(key, label, outcome, *, detail=None, who='target', people=(0, 0, 0), trust=0, business=None, read=()):
    o = {'key': key, 'label': label, 'outcome': outcome, 'who': who, 'people': list(people), 'trust': trust, 'business': business or {}, 'read': [{'skill': s, 'band': b} for s, b in read]}
    if detail:
        o['detail'] = detail
    return o


events = [
    {'key': 'pricing_change', 'title': 'A new pricing model', 'body': body('Northwind moves every plan to usage pricing. Clients have questions, and so does the team.'),
     'card': 'impact', 'period': 1, 'subPeriod': 1, 'impact': [-1, -4, -6], 'target': 'team'},
    {'key': 'review_site', 'title': 'A harsh review online', 'body': body('A client posts a harsh review of the onboarding. Prospects mention it on calls.'),
     'card': 'signal', 'period': 2, 'subPeriod': 1, 'impact': [0, -4, -4], 'target': 'team', 'delivery': 'bulletin',
     'impactText': 'Morale and result dip across the team unless you help them answer it.', 'business': {'variables': {'reputation': -3}}},
    # Choice 1: short term revenue against customer trust.
    {'key': 'discount_deal', 'title': 'A deep discount to close this week', 'card': 'opportunity', 'period': 2, 'subPeriod': 2, 'target': 'member',
     'body': body('{name} can close a large client this week, but only with a 25% discount the client did not ask for until {name} offered it.'),
     'choice': {'known': ['The client\'s budget year ends on Friday.', 'Your sponsor wants this quarter\'s number.'], 'within': 2, 'default': 'discount', 'options': [
         opt('discount', 'Approve the discount and close this week', 'The deal closes. The client now expects a discount every time.', people=(0, 3, 4),
             business={'revenue': 15000, 'variables': {'customer_trust': -6, 'reputation': -4}, 'set': ['discounted']},
             read=[('results_ownership', 'adequate'), ('difficult_conversations', 'weak')]),
         opt('value', 'Hold the price and help them build the business case', '{name} goes back with a business case instead of a discount. The client asks for a week.', people=(0, -2, 0), trust=2,
             business={'variables': {'customer_trust': 4}, 'followUps': [{'event': 'client_signs', 'weeks': 1}]},
             read=[('coaching_for_growth', 'strong'), ('results_ownership', 'strong')]),
         opt('walk', 'Let it go and focus on the next deal', 'No deal this quarter. Your sponsor asks why.',
             business={'sponsor': -5}, read=[('results_ownership', 'weak')]),
     ]}},
    {'key': 'client_signs', 'title': 'The client signs at full price', 'body': body('The business case worked: the client signs at full price, and says why.'),
     'card': 'opportunity', 'impact': [0, 3, 2], 'target': 'stage:close',
     'if': [{'kind': 'variable', 'variable': 'customer_trust', 'op': 'atLeast', 'value': 60}],
     'business': {'revenue': 15000, 'variables': {'customer_trust': 3, 'reputation': 2}}},
    {'key': 'performance_declines', 'title': 'Results are slipping', 'body': body('{name}\'s numbers have dropped two weeks in a row. {name} has gone quiet in team calls.'),
     'card': 'diagnostic', 'period': 2, 'subPeriod': 3, 'impact': [0, -6, -10], 'target': 'member',
     'response': {'actions': ['f2f', 'coach', 'feedback'], 'within': 2, 'onTime': [0, 3, 2]}, 'escalation': {'sponsor': True}},
    # Choice 2: wellbeing against delivery.
    {'key': 'release_crunch', 'title': 'The go live is at risk', 'card': 'crisis', 'period': 3, 'subPeriod': 2, 'target': 'team',
     'body': body('A big client goes live in nine days. The integration is behind, and the team is already tired.'),
     'choice': {'known': ['Three people worked late every night last week.', 'The client has told their board the date.'], 'within': 2, 'default': 'weekend', 'options': [
         opt('weekend', 'Ask everyone to work the weekend', 'The date holds. The team is exhausted, and some of the work was rushed.', who='team', people=(0, -4, 3),
             business={'variables': {'quality': 3, 'customer_trust': 3}, 'set': ['weekend_push']},
             read=[('results_ownership', 'adequate'), ('situational_flexibility', 'weak')]),
         opt('move', 'Move the date and tell the client why', 'The client is unhappy for a day, then thanks you for the honesty. The team breathes.', who='team', people=(0, 3, 0), trust=2,
             business={'variables': {'customer_trust': -5}, 'sponsor': -5},
             read=[('communicating_change', 'strong'), ('difficult_conversations', 'strong')]),
         opt('contractor', 'Bring in a contractor for two weeks', 'The contractor closes the gap. It costs, and the team is relieved.', who='team', people=(0, 2, 1),
             business={'variables': {'budget': -20000, 'quality': 2}},
             read=[('results_ownership', 'strong'), ('coaching_for_growth', 'adequate')]),
     ]}},
    {'key': 'recession', 'title': 'Clients freeze their budgets', 'body': body('Clients across the region freeze new spending. Your sponsor calls: she wants to know your plan.'),
     'card': 'crisis', 'period': 3, 'subPeriod': 3, 'impact': [0, -5, -5], 'target': 'team', 'delivery': 'sponsorCall',
     'response': {'actions': ['meet'], 'within': 2, 'onTime': [0, 2, 0]}, 'escalation': {'sponsor': True}},
    # Choice 3: cost against capability.
    {'key': 'training_or_hire', 'title': 'Finance wants a cut', 'card': 'diagnostic', 'period': 4, 'subPeriod': 2, 'target': 'team',
     'body': body('Finance asks every team for a 15% cut this quarter. The biggest line you control is training.'),
     'choice': {'known': ['Two people are booked on the negotiation course.', 'Travel is the other line you control.'], 'within': 2, 'default': 'cut', 'options': [
         opt('cut', 'Cut the training budget', 'Finance is pleased. The two people hear their course is off.', who='team', people=(0, -2, 0),
             business={'variables': {'budget': 15000}, 'set': ['budget_cut']}, read=[('coaching_for_growth', 'weak')]),
         opt('travel', 'Keep the training and cut travel instead', 'The course goes ahead. Fewer client visits this quarter.', who='team', people=(2, 2, 0),
             business={'variables': {'customer_trust': -3, 'reputation': -2}},
             read=[('coaching_for_growth', 'strong'), ('situational_flexibility', 'adequate')]),
         opt('fund', 'Push back on finance and keep both', 'You keep both lines. Your sponsor has to defend it upstairs and is not happy.', who='team', people=(3, 3, 0),
             business={'variables': {'budget': -10000}, 'sponsor': -8},
             read=[('coaching_for_growth', 'strong'), ('results_ownership', 'weak')]),
     ]}},
    {'key': 'discount_comes_back', 'title': 'The discounted client wants more', 'body': body('The client you discounted asks for the same discount on the renewal, and mentions it to two other clients.'),
     'card': 'impact', 'period': 4, 'subPeriod': 4, 'impact': [0, -3, -2], 'target': 'team',
     'if': [{'kind': 'flag', 'flag': 'discounted'}],
     'business': {'revenue': -10000, 'variables': {'customer_trust': -4, 'reputation': -3}}},
    # Choice 4: transparency against confidentiality.
    {'key': 'reorg_rumour', 'title': 'Rumors of a merger', 'card': 'signal', 'period': 5, 'subPeriod': 2, 'target': 'team',
     'body': body('Your sponsor told you in confidence that two teams will merge next quarter. People are asking you directly.'),
     'choice': {'known': ['Nothing is official for three weeks.', 'Your sponsor asked you to keep it to yourself.'], 'within': 2, 'default': 'silent', 'options': [
         opt('tell', 'Tell the team what you know', 'The team trusts you more. Your sponsor hears you shared it, and trusts you less.', who='team', people=(0, 2, 0), trust=5,
             business={'sponsor': -12, 'variables': {'reputation': -2}},
             read=[('communicating_change', 'adequate'), ('difficult_conversations', 'weak')]),
         opt('silent', 'Say nothing until it is official', 'You say nothing. The questions stop, for now.',
             business={'followUps': [{'event': 'news_leaks', 'weeks': 1}]}, read=[('communicating_change', 'weak')]),
         opt('limits', 'Say a change is coming and you will share details when you can', 'The team knows what you can and cannot say, and that you will say more soon.', who='team', people=(0, 1, 0), trust=2,
             read=[('communicating_change', 'strong'), ('difficult_conversations', 'strong')]),
     ]}},
    {'key': 'news_leaks', 'title': 'The merger news leaks', 'body': body('The team hears about the merger from another department before they hear it from you.'),
     'card': 'impact', 'impact': [0, -6, -3], 'target': 'team', 'business': {'variables': {'reputation': -2}}},
    {'key': 'job_offer', 'title': 'An offer from Cirrus Systems', 'body': body('{name} has an offer from Cirrus Systems and is tempted to take it.'),
     'card': 'capacity', 'period': 5, 'subPeriod': 1, 'impact': [0, -5, -5], 'target': 'member', 'delivery': 'chat',
     'response': {'actions': ['f2f', 'reward', 'coach'], 'within': 2, 'onTime': [0, 4, 0]}, 'escalation': {'sponsor': False}},
    {'key': 'weekend_bites', 'title': 'Off sick after the crunch', 'body': body('{name} is off sick after the weekend push. The rushed work needs fixing too.'),
     'card': 'capacity', 'period': 5, 'subPeriod': 4, 'impact': [0, -5, -4], 'target': 'member', 'away': 2,
     'if': [{'kind': 'flag', 'flag': 'weekend_push'}, {'kind': 'metric', 'metric': 'teamMorale', 'op': 'below', 'value': 55}],
     'business': {'variables': {'quality': -5}}},
    {'key': 'training_ask', 'title': 'Two people ask for the training you cut', 'body': body('Two of your team ask when the negotiation course will be back. They had planned their quarter around it.'),
     'card': 'signal', 'period': 6, 'subPeriod': 3, 'impact': [0, -4, 0], 'target': 'team',
     'if': [{'kind': 'flag', 'flag': 'budget_cut'}, {'kind': 'metric', 'metric': 'teamMorale', 'op': 'below', 'value': 60}],
     'response': {'actions': ['meet', 'training', 'coach'], 'within': 2, 'onTime': [0, 3, 0]}, 'escalation': {'sponsor': False}},
    {'key': 'reference_call', 'title': 'A reference call goes badly', 'body': body('A prospect calls one of your clients for a reference. It does not go well.'),
     'card': 'impact', 'period': 7, 'subPeriod': 2, 'impact': [0, -3, -3], 'target': 'team',
     'if': [{'kind': 'variable', 'variable': 'reputation', 'op': 'below', 'value': 45}],
     'business': {'revenue': -10000, 'variables': {'customer_trust': -3}}},
    {'key': 'process_change', 'title': 'More approvals', 'body': body('Northwind adds a legal review to every contract. Deals slow down.'),
     'card': 'impact', 'period': 7, 'subPeriod': 1, 'impact': [0, -9, -10], 'target': 'team', 'delivery': 'bulletin',
     'impactText': 'More approvals slow every stage. Morale and result fall unless you help the team adjust.'},
    {'key': 'outage', 'title': 'A cloud outage', 'body': body('The platform is down for six hours. Every client call this week starts with it.'),
     'card': 'impact', 'period': 8, 'subPeriod': 1, 'impact': [0, -2, -3], 'target': 'team', 'delivery': 'bulletin',
     'impactText': 'A small dip in morale and result.', 'business': {'variables': {'customer_trust': -2, 'quality': -2}}},
    {'key': 'big_referral', 'title': 'A big referral', 'body': body('A happy client refers a large new account to the team.'),
     'card': 'opportunity', 'window': {'from': 3, 'to': 6, 'probability': 60}, 'impact': [0, 3, 4], 'target': 'stage:demo',
     'business': {'variables': {'reputation': 2}}},
    {'key': 'team_morale_alarm', 'title': 'Dana has heard the team is struggling', 'body': body('Dana calls. Word has reached her that your team is worn out, and she wants to know what you are doing about it.'),
     'card': 'crisis', 'when': {'condition': 'teamMoraleBelow', 'value': 40, 'periods': 2}, 'impact': [0, 0, 0], 'target': 'sponsor', 'delivery': 'sponsorCall',
     'response': {'actions': ['reply'], 'within': 2, 'onTime': [0, 0, 0]}, 'escalation': {'sponsor': True}},
]

# Stakeholders outside the team (D165): the client's account lead, Northwind's CFO and a peer who runs delivery.
# Each has a relationship of their own; the choices above move it, and they ask for things by a deadline.
def eff(trust=0, satisfaction=0, *, business=None, people=None, who='team', outcome=None, needs=None, otherwise=None):
    e = {'trust': trust, 'satisfaction': satisfaction}
    if business:
        e['business'] = business
    if people:
        e['people'], e['who'] = list(people), who
    if outcome:
        e['outcome'] = outcome
    if needs:
        e['needs'] = needs
    if otherwise:
        e['otherwise'] = otherwise
    return e


stakeholders = [
    {'key': 'client_lead', 'name': 'Priya Shah', 'role': 'Head of Finance Operations, Halcyon Retail', 'kind': 'customer', 'pronoun': 'she',
     'about': 'Leads Halcyon Retail\'s account, Northwind\'s largest client. She chose the platform and her reputation rides on the go live.',
     'hiddenConcern': 'Her own CFO has asked her to look at Cirrus Systems if the go live slips again.',
     'concernLine': 'Honestly, my CFO has asked me to get a quote from Cirrus. I do not want to, but I need this go live to land.',
     'npc': {'motivatedBy': 'A go live her finance team can rely on, and not being surprised.', 'avoid': 'What Halcyon pays other vendors.',
             'speech': {'pace': 60, 'warmth': 45, 'formality': 70, 'replyLength': 'short'}},
     'start': {'trust': 55, 'satisfaction': 55}, 'drift': {'trust': 0, 'satisfaction': -3},
     'interactions': [
         {'key': 'checkin', 'type': 'meet', 'label': 'Meet Priya', 'goal': 'Hear what Priya needs from the account team, and agree what happens next.',
          'consequences': {'strong': eff(6, 6, business={'variables': {'customer_trust': 3}}), 'adequate': eff(2, 3, business={'variables': {'customer_trust': 1}}),
                           'weak': eff(-3, -4, business={'variables': {'customer_trust': -1}}), 'harmful': eff(-8, -10, business={'variables': {'customer_trust': -4, 'reputation': -2}})}},
         {'key': 'update', 'type': 'email', 'label': 'Email Priya an update', 'goal': 'Write Priya a clear update on the go live: where it stands, what is next and when.',
          'consequences': {'strong': eff(4, 4, business={'variables': {'customer_trust': 2}}), 'weak': eff(-2, -3)}},
         {'key': 'scope', 'type': 'negotiate', 'label': 'Negotiate the go live scope', 'from': 3,
          'goal': 'Agree with Priya what goes live first and what follows, so the date holds without burning the team.',
          'consequences': {'strong': eff(4, 6, business={'variables': {'customer_trust': 4, 'quality': 3}, 'set': ['scope_agreed']}, people=(0, 2, 0)),
                           'adequate': eff(2, 2, business={'variables': {'customer_trust': 1, 'quality': 1}}),
                           'weak': eff(-3, -4, business={'variables': {'customer_trust': -2}}), 'harmful': eff(-8, -10, business={'variables': {'customer_trust': -5}})}},
     ]},
    {'key': 'cfo', 'name': 'Helen Brandt', 'role': 'Chief Financial Officer, Northwind Cloud', 'kind': 'executive', 'pronoun': 'she',
     'about': 'Owns Northwind\'s budget. Generous with teams that show her the numbers early, hard on those that surprise her.',
     'hiddenConcern': 'The board wants a 10% cost cut next quarter and she has not told the business yet.',
     'concernLine': 'Between us, the board is pushing for cuts next quarter. I need to know where the money actually works.',
     'npc': {'motivatedBy': 'Forecasts she can trust, and money that shows a return.', 'avoid': 'Other teams\' budgets.',
             'speech': {'pace': 45, 'warmth': 30, 'formality': 85, 'replyLength': 'short'}},
     'start': {'trust': 45, 'satisfaction': 50}, 'drift': {'trust': 0, 'satisfaction': -2},
     'interactions': [
         {'key': 'forecast', 'type': 'present', 'label': 'Present the forecast', 'goal': 'Brief Helen on the quarter: the numbers, the biggest risk and what you need.',
          'consequences': {'strong': eff(6, 6, business={'sponsor': 4}), 'adequate': eff(3, 3), 'weak': eff(-3, -4, business={'sponsor': -3}),
                           'harmful': eff(-8, -10, business={'sponsor': -6})}},
         {'key': 'contractor', 'type': 'negotiate', 'kind': 'static', 'label': 'Ask for contractor budget', 'from': 2, 'options': [
             {'key': 'ask', 'label': 'Ask for $20,000 for a contractor this quarter', 'detail': 'She says yes to teams she trusts.',
              'effect': eff(2, -3, business={'variables': {'budget': 20000, 'quality': 2}}, people=(0, 3, 1),
                            outcome='Helen releases the money: a contractor joins for the go live.', needs={'trust': 55},
                            otherwise=eff(0, -5, outcome='Helen says no: show her the numbers first.')),
              'read': [{'skill': 'results_ownership', 'band': 'strong'}]},
             {'key': 'wait', 'label': 'Hold off until the numbers improve', 'effect': eff(0, 2, outcome='You keep the ask for later.'),
              'read': [{'skill': 'results_ownership', 'band': 'adequate'}]},
         ]},
     ]},
    {'key': 'delivery_lead', 'name': 'Elena Ruiz', 'role': 'Head of Delivery, Northwind Cloud', 'kind': 'peer', 'pronoun': 'she',
     'about': 'Runs the engineers who integrate and launch what your team sells. Her team is stretched across every client.',
     'npc': {'motivatedBy': 'Promises her engineers can keep.', 'speech': {'pace': 55, 'warmth': 60, 'formality': 40, 'replyLength': 'medium'}},
     'start': {'trust': 50, 'satisfaction': 50}, 'drift': {'trust': 0, 'satisfaction': -2},
     'interactions': [
         {'key': 'sync', 'type': 'meet', 'label': 'Meet Elena', 'goal': 'Agree with Elena what your team sells and what hers can deliver.',
          'consequences': {'strong': eff(6, 6, business={'variables': {'quality': 2}}), 'adequate': eff(2, 3), 'weak': eff(-3, -4), 'harmful': eff(-8, -10, business={'variables': {'quality': -2}})}},
         {'key': 'priorities', 'type': 'negotiate', 'label': 'Negotiate priorities', 'from': 3,
          'goal': 'Agree with Elena which client work comes first, and what each team gives so the go live lands.',
          'consequences': {'strong': eff(5, 5, business={'variables': {'quality': 4, 'customer_trust': 2}}, people=(0, 2, 1)),
                           'adequate': eff(2, 2, business={'variables': {'quality': 2}}), 'weak': eff(-3, -4, business={'variables': {'quality': -1}}),
                           'harmful': eff(-8, -10, business={'variables': {'quality': -3}})}},
     ]},
]

# What the choices do to each relationship (D165).
CHOICE_STAKEHOLDERS = {
    ('discount_deal', 'discount'): {'client_lead': {'trust': -4, 'satisfaction': 4}},
    ('discount_deal', 'value'): {'client_lead': {'trust': 5, 'satisfaction': 2}},
    ('discount_deal', 'walk'): {'client_lead': {'satisfaction': -6}},
    ('release_crunch', 'weekend'): {'client_lead': {'satisfaction': 4}, 'delivery_lead': {'satisfaction': -4}},
    ('release_crunch', 'move'): {'client_lead': {'trust': 3, 'satisfaction': -5}, 'delivery_lead': {'trust': 4, 'satisfaction': 5}},
    ('release_crunch', 'contractor'): {'cfo': {'satisfaction': -4}, 'delivery_lead': {'satisfaction': 3}},
    ('training_or_hire', 'cut'): {'cfo': {'trust': 3, 'satisfaction': 6}},
    ('training_or_hire', 'travel'): {'cfo': {'satisfaction': 3}, 'client_lead': {'satisfaction': -2}},
    ('training_or_hire', 'fund'): {'cfo': {'trust': -4, 'satisfaction': -8}},
}
for e in events:
    for o in e.get('choice', {}).get('options', []):
        moved = CHOICE_STAKEHOLDERS.get((e['key'], o['key']))
        if moved:
            o['business'] = {**o['business'], 'stakeholders': moved}

events += [
    # Stakeholder requests (D162): ignoring them hurts the relationship and the business.
    {'key': 'client_call', 'title': 'Priya asks for a call about the review', 'stakeholder': 'client_lead', 'delivery': 'email',
     'body': body('Priya has seen the review online and wants to talk before her CFO asks her about it. Can we speak this week?'),
     'card': 'signal', 'period': 2, 'subPeriod': 2, 'target': 'team',
     'request': {'kind': 'meeting', 'interaction': 'checkin', 'within': 2,
                 'onTime': eff(4, 4, business={'variables': {'customer_trust': 2}}),
                 'ifIgnored': eff(-5, -8, business={'variables': {'customer_trust': -4, 'reputation': -2}})},
     'escalation': {'sponsor': True}},
    {'key': 'delivery_ask', 'title': 'Elena asks to agree priorities before the go live', 'stakeholder': 'delivery_lead', 'delivery': 'email',
     'body': body('Elena\'s engineers are split across three launches. She wants to agree with you which work comes first before the go live.'),
     'card': 'signal', 'period': 3, 'subPeriod': 1, 'target': 'team',
     'request': {'kind': 'meeting', 'interaction': 'priorities', 'within': 2,
                 'onTime': eff(3, 3, business={'variables': {'quality': 2}}),
                 'ifIgnored': eff(-6, -8, business={'variables': {'quality': -3}})}},
    {'key': 'cost_plan', 'title': 'Helen wants your cost plan by Thursday', 'stakeholder': 'cfo', 'delivery': 'email',
     'body': body('Before finance decides the cuts, send me your cost plan for the quarter: what you spend, and what it buys.'),
     'card': 'diagnostic', 'period': 4, 'subPeriod': 1, 'target': 'team',
     'request': {'kind': 'message', 'within': 3, 'onTime': eff(4, 4, business={'sponsor': 2}), 'ifIgnored': eff(-6, -8, business={'sponsor': -5})}},
    # Consequences that carry forward through a relationship (D163).
    {'key': 'client_escalates', 'title': 'Priya escalates to Dana', 'stakeholder': 'client_lead',
     'body': body('Priya has written to Dana: she feels nobody on your team is listening. Dana forwards it to you without a word.'),
     'card': 'crisis', 'period': 6, 'subPeriod': 2, 'impact': [0, -3, 0], 'target': 'team',
     'if': [{'kind': 'stakeholder', 'stakeholder': 'client_lead', 'measure': 'satisfaction', 'op': 'below', 'value': 40}],
     'business': {'sponsor': -6, 'variables': {'customer_trust': -4}}},
    {'key': 'client_renews', 'title': 'Halcyon renews early', 'stakeholder': 'client_lead',
     'body': body('Priya renews Halcyon\'s contract a quarter early and asks for two more modules. She says it is because your team kept its promises.'),
     'card': 'opportunity', 'period': 8, 'subPeriod': 1, 'impact': [0, 3, 0], 'target': 'team',
     'if': [{'kind': 'stakeholder', 'stakeholder': 'client_lead', 'measure': 'trust', 'op': 'atLeast', 'value': 65}],
     'business': {'revenue': 12000, 'variables': {'customer_trust': 3, 'reputation': 2}}},
]

storyline = {
    'id': 'client_trust',
    'name': 'Client Trust, Northwind Cloud',
    'organisation': 'Northwind Cloud',
    'intro': {
        'welcome': ['Welcome to Northwind Cloud. I am glad you are here.', 'You lead the account team of ten that takes every client from first call to signed contract.',
                    'This quarter I need the number, and I need clients who still trust us when it is in. You will not always be able to have both.'],
        'product': ['We sell a data platform that finance teams use to close their books faster.', 'Every deal moves through five stages: Prospect, Discover, Demo, Propose and Close.'],
        'targets': ['Reach $240,000 in new revenue over eight weeks.', 'Watch the budget, customer trust and product quality on your board: your choices move them.',
                    'A burned out team will not hold the number next quarter.',
                    'Three people outside your team matter too: Priya at Halcyon Retail, Helen in finance and Elena in delivery.'],
    },
    'money': {**se['money']},
    'time': se['time'],
    'stages': stages,
    'sponsor': {'name': 'Dana Okafor', 'title': 'VP, Client Success', 'styleLine': 'Each of your people needs something different from you this week.'},
    'members': members,
    'candidates': candidates,
    'actions': actions,
    'weeklyStyle': se['weeklyStyle'],
    'events': events,
    'triggers': json.loads(words(json.dumps(se['triggers']))),
    'variables': [
        {'key': 'budget', 'name': 'Budget', 'format': 'money', 'start': 60000, 'min': 0, 'max': 150000, 'about': 'What you can spend this quarter beyond salaries: training, team events, contractors and hires.'},
        {'key': 'customer_trust', 'name': 'Customer trust', 'format': 'percent', 'start': 70, 'min': 0, 'max': 100, 'weight': 0.2, 'about': 'How much your clients trust Northwind to keep its promises. It counts in your Business score.'},
        {'key': 'quality', 'name': 'Product quality', 'format': 'points', 'start': 60, 'min': 0, 'max': 100, 'drift': -1, 'weight': 0.1, 'about': 'How well what the team delivers works for clients. It slips a little each week without care.'},
        {'key': 'reputation', 'name': 'Reputation', 'format': 'points', 'start': 50, 'min': 0, 'max': 100, 'shown': False, 'about': 'What the market says about Northwind. You do not see it, but prospects do.'},
    ],
    'dynamics': {},
    'stakeholders': stakeholders,
    'performanceThreshold': se['performanceThreshold'],
    'calibrated': False,
}

out = root / 'src/engine/storylines/client-trust.json'
out.write_text(json.dumps(storyline, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print(f'wrote {out.relative_to(root)}')
