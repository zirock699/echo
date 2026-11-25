"""Account-switch regression in one synthetic browser profile."""

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def library(title):
    return {
        'lessons': [{
            'id': 'shared "legacy" id', 'title': title, 'phrases': [], 'statuses': {},
            'progress': {'position': 0, 'coverage': []}, 'createdAt': 1,
        }],
        'collections': [], 'sessions': [], 'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1},
    }


def run():
    with browser_fixture(__doc__, 'synthetic identity and metadata, no playback') as fixture:
        page, errors = fixture.open_page(390, 844)
        current = {'account': 'a', 'offline': False}
        data = {'a': library('Private “A” <notes>'), 'b': library('Private B')}
        data['a']['collections'] = [{'id': 'List "quotes" & notes', 'name': 'Reading list', 'lessonIds': ['shared "legacy" id']}]
        revision = {'a': 1, 'b': 1}

        def state(route):
            if current['offline']:
                return route.abort()
            account = current['account']
            if account is None:
                return route.fulfill(status=401, json={'error': 'Sign in'})
            owner = account * 64
            if route.request.method == 'PUT':
                assert route.request.headers['x-echo-owner'] == owner
                data[account] = route.request.post_data_json['data']
                revision[account] += 1
                return route.fulfill(headers={'x-echo-owner': owner}, json={'revision': revision[account]})
            route.fulfill(headers={'x-echo-owner': owner}, json={'revision': revision[account], 'data': data[account]})

        page.route(fixture.origin + '/api/state', state)
        page.reload(wait_until='domcontentloaded')
        resume = page.get_by_role('button', name='Resume lesson')
        expect(resume).to_contain_text('Private “A” <notes>')
        expect(resume).to_have_attribute('data-id', 'shared "legacy" id')
        page.locator('#rehearsal-settings').click()
        current['offline'] = True
        page.locator('[data-pref=theme]').select_option('light')
        notice = page.get_by_role('complementary', name='Synchronisation status')
        expect(notice.get_by_role('status')).to_have_text('Sync is unavailable. Pending changes are saved on this device.')

        current.update(account='b', offline=False)
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_role('button', name='Resume lesson')).to_contain_text('Private B')
        expect(page.get_by_text('Private “A” <notes>', exact=True)).to_have_count(0)
        page.go_back()
        expect(resume).to_contain_text('Private B')
        assert 'theme' not in data['b']['preferences']
        assert revision['b'] == 1

        current['account'] = None
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_role('heading', name='Library unavailable')).to_be_visible()
        expect(page.get_by_text('Private B', exact=True)).to_have_count(0)

        current['account'] = 'a'
        page.get_by_role('button', name='Retry', exact=True).click()
        expect(page.get_by_role('button', name='Resume lesson')).to_contain_text('Private “A” <notes>')
        page.locator('#rehearsal-settings').click()
        expect(page.locator('[data-pref=theme]')).to_have_value('light')
        page.get_by_role('button', name='Back', exact=True).click()
        resume.click()
        page.get_by_role('button', name='Player settings', exact=True).click()
        page.get_by_role('tab', name='Lesson', exact=True).click()
        expect(page.locator('[data-collection-toggle]')).to_be_checked()
        with page.expect_response(lambda response: response.url.endswith('/api/state') and response.request.method == 'PUT'):
            page.get_by_role('button', name='Save', exact=True).click()
        assert data['a']['collections'][0]['lessonIds'] == ['shared "legacy" id']

        current['offline'] = True
        page.reload(wait_until='domcontentloaded')
        expect(page.get_by_role('heading', name='Library unavailable')).to_be_visible()
        expect(page.get_by_text('Private “A” <notes>', exact=True)).to_have_count(0)
        assert not errors, errors
        print('PASS account switch, pending-work isolation, sign-out and cold offline lock at 390×844.')


if __name__ == '__main__':
    run()
