#!/usr/bin/python
# -*- coding: utf-8 -*-
from five import grok
from Products.CMFCore.interfaces import ISiteRoot
from Products.CMFCore.utils import getToolByName
import json


class Dynatree_Content(grok.View):

    grok.context(ISiteRoot)
    grok.require('zope2.View')

    def __call__(self, object_provides=''):
        catalog = getToolByName(self.context, 'portal_catalog')
        object_provides = object_provides.split('|')
        flat_results = {}
        root = []
        bla = dict(
            title='Root',
            key='root',
            children=root,
            select=False,
            hideCheckbox=True,
            isFolder=True,
            expand=True,
            )
        if object_provides and object_provides[0]:
            results = catalog.searchResults(sort_on='path',
                    object_provides=object_provides)
        else:
            results = catalog.searchResults(sort_on='path')
        for result in results:
            path = result.getPath().split('/')
            parent = None
            for i in range(1, len(path)):
                subpath = '/'.join(path[0:-i])
                if subpath in flat_results:
                    parent = flat_results[subpath]
            new_item = {}
            new_item['title'] = result.Title
            new_item['key'] = result.UID
            new_item['children'] = []
            new_item['select'] = False
            new_item['isFolder'] = False
            new_item['hideCheckbox'] = False
            new_item['expand'] = False
            if parent:
                parent['isFolder'] = True
                parent['select'] = False
                parent['children'].append(new_item)
            else:
                root.append(new_item)
            flat_results[result.getPath()] = new_item
        return json.dumps([bla])

    def render(self):
        pass


def isSomethingSelectedInChildren(children, selected):
    return bool(set([_['key'] for _ in
                children]).intersection(selected)) or bool([_ for _ in
            children if _['children']
            and isSomethingSelectedInChildren(_['children'], selected)])
